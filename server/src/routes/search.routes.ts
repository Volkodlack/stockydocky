import { Router } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/search?q=... — recherche instantanée (code-barres, réf, nom, marque, zone)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 1) return res.json({ articles: [] });

    const articles = await prisma.article.findMany({
      where: {
        OR: [
          { reference: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { zone: { code: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        reference: true,
        barcode: true,
        brand: true,
        name: true,
        stock: true,
        minStock: true,
        salePrice: true,
        zone: { select: { code: true } },
      },
      orderBy: { name: 'asc' },
      take: 12,
    });

    res.json({ articles });
  }),
);

export default router;
