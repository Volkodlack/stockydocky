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
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json(suppliers);
  }),
);

router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    if (data.email === '') data.email = null;
    const supplier = await prisma.supplier.create({ data });
    await logAction(req.user!.sub, 'SUPPLIER_CREATE', 'Supplier', supplier.id);
    res.status(201).json(supplier);
  }),
);

router.put(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    if (data.email === '') data.email = null;
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    res.json(supplier);
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'SUPPLIER_DELETE', 'Supplier', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
