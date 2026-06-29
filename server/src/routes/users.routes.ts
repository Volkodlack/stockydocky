import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { adminOnly } from '../middleware/roles';
import { hashPassword } from '../utils/auth';
import { badRequest, logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate, adminOnly);

const select = { id: true, username: true, name: true, role: true, active: true, createdAt: true } as const;

const createSchema = z.object({
  username: z.string().min(1, 'Identifiant requis').transform((s) => s.trim().toLowerCase()),
  name: z.string().min(1, 'Nom requis'),
  password: z.string().min(6, 'Mot de passe : 6 caractères minimum'),
  role: z.enum(['ADMIN', 'EMPLOYEE', 'INVENTORY']).default('EMPLOYEE'),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'EMPLOYEE', 'INVENTORY']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// GET /api/users
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select, orderBy: { createdAt: 'asc' } });
    res.json(users);
  }),
);

// POST /api/users
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const user = await prisma.user.create({
      data: { ...body, password: await hashPassword(body.password) },
      select,
    });
    await logAction(req.user!.sub, 'USER_CREATE', 'User', user.id, { username: user.username, role: user.role });
    res.status(201).json(user);
  }),
);

// PUT /api/users/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const data: Record<string, unknown> = { ...body };
    if (body.password) data.password = await hashPassword(body.password);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select });
    await logAction(req.user!.sub, 'USER_UPDATE', 'User', user.id);
    res.json(user);
  }),
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.sub) throw badRequest('Vous ne pouvez pas supprimer votre propre compte');
    await prisma.user.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'USER_DELETE', 'User', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
