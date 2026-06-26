import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { inventoryAccess } from '../middleware/roles';
import { applyMovement } from '../lib/stock';
import { badRequest, conflict, logAction, nextDocumentNumber, notFound } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  type: z.enum(['FULL', 'ZONE', 'ROLLING']).default('FULL'),
  zoneId: z.string().optional().nullable(),
  articleIds: z.array(z.string()).optional(),
  notes: z.string().trim().optional().nullable(),
});

const countSchema = z.object({
  counts: z.array(z.object({ articleId: z.string(), countedQty: z.coerce.number().int().min(0) })).min(1),
});

/** Construit la réponse détaillée avec calcul des écarts. */
function withVariances(items: Array<{
  id: string;
  theoreticalQty: number;
  countedQty: number | null;
  article: { id: string; reference: string; name: string; brand: string | null; purchasePrice: unknown; zone: { code: string } | null };
}>) {
  return items.map((it) => {
    const counted = it.countedQty;
    const variance = counted === null ? null : counted - it.theoreticalQty;
    const purchase = Number(it.article.purchasePrice);
    return {
      id: it.id,
      articleId: it.article.id,
      reference: it.article.reference,
      name: it.article.name,
      brand: it.article.brand,
      zone: it.article.zone?.code ?? null,
      theoreticalQty: it.theoreticalQty,
      countedQty: counted,
      variance,
      varianceValue: variance === null ? null : variance * purchase,
    };
  });
}

// GET /api/inventory — liste
router.get(
  '/',
  inventoryAccess,
  asyncHandler(async (_req, res) => {
    const list = await prisma.inventory.findMany({
      include: { zone: { select: { code: true } }, user: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  }),
);

// POST /api/inventory — ouvre une session d'inventaire
router.post(
  '/',
  inventoryAccess,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const reference = await nextDocumentNumber('INV');

    // sélection des articles selon le type
    let articles;
    if (body.type === 'ZONE') {
      if (!body.zoneId) throw badRequest('Zone requise pour un inventaire par zone');
      articles = await prisma.article.findMany({ where: { zoneId: body.zoneId, active: true } });
    } else if (body.type === 'ROLLING') {
      if (!body.articleIds?.length) throw badRequest('Sélection d\'articles requise pour un inventaire tournant');
      articles = await prisma.article.findMany({ where: { id: { in: body.articleIds }, active: true } });
    } else {
      articles = await prisma.article.findMany({ where: { active: true } });
    }
    if (articles.length === 0) throw badRequest('Aucun article à inventorier');

    const inventory = await prisma.inventory.create({
      data: {
        reference,
        type: body.type,
        zoneId: body.zoneId || null,
        notes: body.notes || null,
        userId: req.user!.sub,
        items: { create: articles.map((a) => ({ articleId: a.id, theoreticalQty: a.stock })) },
      },
      include: { _count: { select: { items: true } } },
    });

    await logAction(req.user!.sub, 'INVENTORY_OPEN', 'Inventory', inventory.id, { reference, type: body.type });
    res.status(201).json(inventory);
  }),
);

// GET /api/inventory/:id — détail + écarts
router.get(
  '/:id',
  inventoryAccess,
  asyncHandler(async (req, res) => {
    const inv = await prisma.inventory.findUnique({
      where: { id: req.params.id },
      include: {
        zone: { select: { code: true } },
        user: { select: { name: true } },
        items: {
          include: { article: { select: { id: true, reference: true, name: true, brand: true, purchasePrice: true, zone: { select: { code: true } } } } },
          orderBy: { article: { name: 'asc' } },
        },
      },
    });
    if (!inv) throw notFound('Inventaire introuvable');
    res.json({ ...inv, items: withVariances(inv.items) });
  }),
);

// PUT /api/inventory/:id/count — enregistre les quantités comptées
router.put(
  '/:id/count',
  inventoryAccess,
  asyncHandler(async (req, res) => {
    const body = countSchema.parse(req.body);
    const inv = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!inv) throw notFound('Inventaire introuvable');
    if (inv.status !== 'IN_PROGRESS') throw conflict('Inventaire déjà clôturé');

    await prisma.$transaction(
      body.counts.map((c) =>
        prisma.inventoryItem.updateMany({
          where: { inventoryId: inv.id, articleId: c.articleId },
          data: { countedQty: c.countedQty },
        }),
      ),
    );
    res.json({ updated: body.counts.length });
  }),
);

// POST /api/inventory/:id/validate — régularise le stock selon les comptages
router.post(
  '/:id/validate',
  inventoryAccess,
  asyncHandler(async (req, res) => {
    const inv = await prisma.inventory.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!inv) throw notFound('Inventaire introuvable');
    if (inv.status !== 'IN_PROGRESS') throw conflict('Inventaire déjà clôturé');

    const counted = inv.items.filter((i) => i.countedQty !== null);
    if (counted.length === 0) throw badRequest('Aucune quantité comptée');

    let adjustments = 0;
    await prisma.$transaction(async (tx) => {
      for (const item of counted) {
        const article = await tx.article.findUnique({ where: { id: item.articleId } });
        if (!article) continue;
        const delta = (item.countedQty as number) - article.stock;
        if (delta !== 0) {
          await applyMovement(tx, {
            articleId: item.articleId,
            type: 'INVENTORY_ADJUSTMENT',
            quantity: delta,
            reason: `Régularisation inventaire ${inv.reference}`,
            reference: inv.reference,
            userId: req.user!.sub,
          });
          adjustments++;
        }
      }
      await tx.inventory.update({
        where: { id: inv.id },
        data: { status: 'VALIDATED', validatedAt: new Date() },
      });
    });

    await logAction(req.user!.sub, 'INVENTORY_VALIDATE', 'Inventory', inv.id, {
      reference: inv.reference,
      regularisations: adjustments,
    });
    res.json({ validated: true, adjustments });
  }),
);

// GET /api/inventory/:id/report — synthèse des écarts
router.get(
  '/:id/report',
  inventoryAccess,
  asyncHandler(async (req, res) => {
    const inv = await prisma.inventory.findUnique({
      where: { id: req.params.id },
      include: {
        zone: { select: { code: true } },
        items: {
          include: { article: { select: { id: true, reference: true, name: true, brand: true, purchasePrice: true, zone: { select: { code: true } } } } },
        },
      },
    });
    if (!inv) throw notFound('Inventaire introuvable');

    const rows = withVariances(inv.items).filter((r) => r.variance !== null);
    const missing = rows.filter((r) => (r.variance as number) < 0);
    const surplus = rows.filter((r) => (r.variance as number) > 0);
    const totalValue = rows.reduce((s, r) => s + (r.varianceValue ?? 0), 0);

    res.json({
      reference: inv.reference,
      type: inv.type,
      zone: inv.zone?.code ?? null,
      status: inv.status,
      counted: rows.length,
      missing: { count: missing.length, items: missing },
      surplus: { count: surplus.length, items: surplus },
      totalVarianceValue: totalValue,
    });
  }),
);

// DELETE /api/inventory/:id — annule un inventaire non validé
router.delete(
  '/:id',
  inventoryAccess,
  asyncHandler(async (req, res) => {
    const inv = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!inv) throw notFound();
    if (inv.status === 'VALIDATED') throw conflict('Un inventaire validé ne peut pas être supprimé');
    await prisma.inventory.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  }),
);

export default router;
