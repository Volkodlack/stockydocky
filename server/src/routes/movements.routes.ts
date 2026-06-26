import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff } from '../middleware/roles';
import { applyMovement } from '../lib/stock';
import { badRequest, ENTRY_TYPES, EXIT_TYPES, logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const lineSchema = z.object({
  articleId: z.string().min(1),
  quantity: z.coerce.number().int().positive('Quantité > 0 requise'),
});

const entrySchema = z.object({
  type: z.enum(['ENTRY_SIMPLE', 'ENTRY_SUPPLIER', 'ENTRY_IMPORT']).default('ENTRY_SIMPLE'),
  supplierId: z.string().optional().nullable(),
  reference: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  items: z.array(lineSchema).min(1, 'Au moins un produit'),
});

const exitSchema = z.object({
  type: z.enum(['EXIT_SALE', 'EXIT_BREAKAGE', 'EXIT_LOSS', 'EXIT_SAV', 'EXIT_RETURN_SUPPLIER']),
  reason: z.string().trim().optional().nullable(),
  items: z.array(lineSchema).min(1, 'Au moins un produit'),
});

const adjustSchema = z.object({
  articleId: z.string().min(1),
  newStock: z.coerce.number().int().min(0),
  reason: z.string().trim().optional().nullable(),
});

// POST /api/movements/entry — entrée de stock
router.post(
  '/entry',
  staff,
  asyncHandler(async (req, res) => {
    const body = entrySchema.parse(req.body);
    const supplierId = body.supplierId || null;
    const ref = body.reference || null;

    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const line of body.items) {
        const { movement } = await applyMovement(tx, {
          articleId: line.articleId,
          type: body.type,
          quantity: Math.abs(line.quantity),
          reason: body.reason,
          reference: ref,
          userId: req.user!.sub,
          supplierId,
        });
        created.push(movement);
      }
      return created;
    });

    await logAction(req.user!.sub, 'STOCK_ENTRY', 'StockMovement', undefined, {
      type: body.type,
      lignes: body.items.length,
      reference: ref,
    });
    res.status(201).json({ created: result.length, movements: result });
  }),
);

// POST /api/movements/exit — sortie de stock
router.post(
  '/exit',
  staff,
  asyncHandler(async (req, res) => {
    const body = exitSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const line of body.items) {
        const { movement } = await applyMovement(tx, {
          articleId: line.articleId,
          type: body.type,
          quantity: -Math.abs(line.quantity), // sortie => négatif
          reason: body.reason,
          userId: req.user!.sub,
        });
        created.push(movement);
      }
      return created;
    });

    await logAction(req.user!.sub, 'STOCK_EXIT', 'StockMovement', undefined, {
      type: body.type,
      lignes: body.items.length,
    });
    res.status(201).json({ created: result.length, movements: result });
  }),
);

// POST /api/movements/adjust — correction de stock (recale le stock à une valeur)
router.post(
  '/adjust',
  staff,
  asyncHandler(async (req, res) => {
    const body = adjustSchema.parse(req.body);
    const article = await prisma.article.findUnique({ where: { id: body.articleId } });
    if (!article) throw badRequest('Article introuvable');
    const delta = body.newStock - article.stock;
    if (delta === 0) return res.json({ unchanged: true, message: 'Stock déjà à cette valeur' });

    const movement = await prisma.$transaction((tx) =>
      applyMovement(tx, {
        articleId: body.articleId,
        type: 'EXIT_CORRECTION',
        quantity: delta,
        reason: body.reason ?? 'Correction manuelle',
        userId: req.user!.sub,
      }),
    );

    await logAction(req.user!.sub, 'STOCK_ADJUST', 'Article', body.articleId, {
      avant: article.stock,
      apres: body.newStock,
    });
    res.json(movement);
  }),
);

// GET /api/movements — historique filtrable
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) ?? '50', 10)));
    const { articleId, type, userId, zoneId, brand, dateFrom, dateTo } = req.query as Record<string, string>;

    const where: Prisma.StockMovementWhereInput = {};
    if (articleId) where.articleId = articleId;
    if (type) {
      if (type === 'ENTRY') where.type = { in: ENTRY_TYPES };
      else if (type === 'EXIT') where.type = { in: EXIT_TYPES };
      else where.type = type as Prisma.StockMovementWhereInput['type'];
    }
    if (userId) where.userId = userId;
    if (zoneId || brand) {
      where.article = {};
      if (zoneId) where.article.zoneId = zoneId;
      if (brand) where.article.brand = { equals: brand, mode: 'insensitive' };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          article: { select: { id: true, reference: true, name: true, brand: true } },
          user: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  }),
);

export default router;
