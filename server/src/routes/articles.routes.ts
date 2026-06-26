import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { adminOnly, staff } from '../middleware/roles';
import { badRequest, logAction, notFound } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const articleSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  barcode: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  name: z.string().min(1, 'Nom requis'),
  description: z.string().trim().optional().nullable(),
  purchasePrice: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  zoneId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

const include = { zone: true, category: true } satisfies Prisma.ArticleInclude;

function clean<T extends Record<string, unknown>>(obj: T): T {
  // convertit les chaînes vides en null pour les clés étrangères / champs optionnels
  for (const k of ['barcode', 'brand', 'description', 'zoneId', 'categoryId'] as const) {
    if (obj[k] === '') (obj as Record<string, unknown>)[k] = null;
  }
  return obj;
}

// GET /api/articles — liste paginée + filtres
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) ?? '25', 10)));
    const q = (req.query.q as string)?.trim();
    const { zoneId, categoryId, brand } = req.query as Record<string, string>;
    const status = req.query.status as string; // all | active | inactive
    const stockFilter = req.query.stock as string; // all | low | out

    const where: Prisma.ArticleWhereInput = {};
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (zoneId) where.zoneId = zoneId;
    if (categoryId) where.categoryId = categoryId;
    if (brand) where.brand = { equals: brand, mode: 'insensitive' };
    if (status === 'active') where.active = true;
    if (status === 'inactive') where.active = false;
    if (stockFilter === 'out') where.stock = { lte: 0 };

    let items = await prisma.article.findMany({
      where,
      include,
      orderBy: { name: 'asc' },
      skip: stockFilter === 'low' ? undefined : (page - 1) * pageSize,
      take: stockFilter === 'low' ? undefined : pageSize,
    });

    let total: number;
    if (stockFilter === 'low') {
      // filtre "sous le stock minimum" : comparaison entre deux colonnes -> en mémoire
      items = items.filter((a) => a.stock <= a.minStock);
      total = items.length;
      items = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    } else {
      total = await prisma.article.count({ where });
    }

    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  }),
);

// GET /api/articles/barcode/:code — lookup pour le scan
router.get(
  '/barcode/:code',
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findFirst({
      where: { barcode: req.params.code },
      include,
    });
    if (!article) throw notFound('Aucun article pour ce code-barres');
    res.json(article);
  }),
);

// GET /api/articles/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUnique({
      where: { id: req.params.id },
      include: {
        ...include,
        movements: { orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true } } } },
      },
    });
    if (!article) throw notFound('Article introuvable');
    res.json(article);
  }),
);

// POST /api/articles — création (admin/employé)
router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const data = clean(articleSchema.parse(req.body));
    const article = await prisma.article.create({ data, include });
    await logAction(req.user!.sub, 'ARTICLE_CREATE', 'Article', article.id, { reference: article.reference });
    res.status(201).json(article);
  }),
);

// PUT /api/articles/:id — mise à jour (admin/employé)
router.put(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const data = clean(articleSchema.partial().parse(req.body));
    // le stock ne se modifie jamais directement ici (passer par un mouvement)
    delete (data as Record<string, unknown>).stock;
    const article = await prisma.article.update({ where: { id: req.params.id }, data, include });
    await logAction(req.user!.sub, 'ARTICLE_UPDATE', 'Article', article.id);
    res.json(article);
  }),
);

// DELETE /api/articles/:id — suppression (admin uniquement)
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const movements = await prisma.stockMovement.count({ where: { articleId: req.params.id } });
    if (movements > 0) {
      // on conserve l'historique : désactivation au lieu de suppression
      const article = await prisma.article.update({ where: { id: req.params.id }, data: { active: false } });
      await logAction(req.user!.sub, 'ARTICLE_DEACTIVATE', 'Article', article.id);
      return res.json({ deactivated: true, message: 'Article désactivé (historique conservé)' });
    }
    await prisma.article.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'ARTICLE_DELETE', 'Article', req.params.id);
    res.json({ deleted: true });
  }),
);

// GET /api/articles/meta/brands — liste des marques (pour filtres)
router.get(
  '/meta/brands',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.article.findMany({
      where: { brand: { not: null } },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' },
    });
    res.json(rows.map((r) => r.brand).filter(Boolean));
  }),
);

export default router;
