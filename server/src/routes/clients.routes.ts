import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff, adminOnly } from '../middleware/roles';
import { logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().min(1, 'Nom requis').transform((s) => s.trim()),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
    res.json(clients);
  }),
);

router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    if (data.email === '') data.email = null;
    const client = await prisma.client.create({ data });
    await logAction(req.user!.sub, 'CLIENT_CREATE', 'Client', client.id);
    res.status(201).json(client);
  }),
);

router.put(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    if (data.email === '') data.email = null;
    const client = await prisma.client.update({ where: { id: req.params.id }, data });
    res.json(client);
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.client.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'CLIENT_DELETE', 'Client', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
