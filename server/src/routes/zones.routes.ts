import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff, adminOnly } from '../middleware/roles';
import { conflict, logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const schema = z.object({
  code: z.string().min(1, 'Code requis').transform((s) => s.trim().toUpperCase()),
  name: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

// GET /api/zones
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const zones = await prisma.zone.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
    res.json(zones);
  }),
);

// POST /api/zones
router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const zone = await prisma.zone.create({ data });
    await logAction(req.user!.sub, 'ZONE_CREATE', 'Zone', zone.id, { code: zone.code });
    res.status(201).json(zone);
  }),
);

// PUT /api/zones/:id
router.put(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    const zone = await prisma.zone.update({ where: { id: req.params.id }, data });
    res.json(zone);
  }),
);

// DELETE /api/zones/:id
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const count = await prisma.article.count({ where: { zoneId: req.params.id } });
    if (count > 0) throw conflict(`${count} article(s) utilisent cette zone`);
    await prisma.zone.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'ZONE_DELETE', 'Zone', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
