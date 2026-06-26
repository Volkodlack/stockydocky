import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff, adminOnly } from '../middleware/roles';
import { conflict, logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().min(1, 'Nom requis').transform((s) => s.trim()),
  description: z.string().trim().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
    res.json(categories);
  }),
);

router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const category = await prisma.category.create({ data });
    await logAction(req.user!.sub, 'CATEGORY_CREATE', 'Category', category.id);
    res.status(201).json(category);
  }),
);

router.put(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json(category);
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const count = await prisma.article.count({ where: { categoryId: req.params.id } });
    if (count > 0) throw conflict(`${count} article(s) utilisent cette catégorie`);
    await prisma.category.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'CATEGORY_DELETE', 'Category', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
