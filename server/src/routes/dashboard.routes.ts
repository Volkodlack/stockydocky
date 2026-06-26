import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { ENTRY_TYPES, EXIT_TYPES } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// GET /api/dashboard
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Indicateurs globaux (1 requête agrégée)
    const stats = await prisma.$queryRaw<
      Array<{
        articleCount: number;
        outOfStock: number;
        lowStock: number;
        purchaseValue: number;
        saleValue: number;
        totalUnits: number;
      }>
    >`
      SELECT
        COUNT(*)::int AS "articleCount",
        COUNT(*) FILTER (WHERE stock <= 0)::int AS "outOfStock",
        COUNT(*) FILTER (WHERE stock <= "minStock")::int AS "lowStock",
        COALESCE(SUM(stock * "purchasePrice"), 0)::float AS "purchaseValue",
        COALESCE(SUM(stock * "salePrice"), 0)::float AS "saleValue",
        COALESCE(SUM(stock), 0)::int AS "totalUnits"
      FROM "Article"
      WHERE active = true;
    `;

    // Mouvements mensuels (6 derniers mois) pour les graphiques
    const monthly = await prisma.$queryRaw<Array<{ month: string; entries: number; exits: number }>>`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0)::int AS entries,
        COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0)::int AS exits
      FROM "StockMovement"
      WHERE "createdAt" >= date_trunc('month', now()) - interval '5 months'
      GROUP BY 1
      ORDER BY 1;
    `;

    // Dernières entrées / sorties
    const [recentEntries, recentExits] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { type: { in: ENTRY_TYPES } },
        include: { article: { select: { reference: true, name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.stockMovement.findMany({
        where: { type: { in: EXIT_TYPES } },
        include: { article: { select: { reference: true, name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    // Top 5 des articles en rupture / sous stock minimum
    const alerts = await prisma.$queryRaw<
      Array<{ id: string; reference: string; name: string; stock: number; minStock: number }>
    >`
      SELECT id, reference, name, stock, "minStock"
      FROM "Article"
      WHERE active = true AND stock <= "minStock"
      ORDER BY (stock - "minStock") ASC
      LIMIT 8;
    `;

    res.json({
      stats: stats[0],
      monthly,
      recentEntries,
      recentExits,
      alerts,
    });
  }),
);

export default router;
