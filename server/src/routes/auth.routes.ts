import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { comparePassword, signToken } from '../utils/auth';
import { logAction, unauthorized } from '../utils/helpers';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
    if (!user || !user.active) {
      throw unauthorized('Identifiants incorrects');
    }
    const ok = await comparePassword(password, user.password);
    if (!ok) {
      throw unauthorized('Identifiants incorrects');
    }

    const token = signToken({ sub: user.id, username: user.username, role: user.role, name: user.name });
    await logAction(user.id, 'AUTH_LOGIN', 'User', user.id);

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  }),
);

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, username: true, name: true, role: true, active: true },
    });
    if (!user || !user.active) throw unauthorized('Session invalide');
    res.json({ user });
  }),
);

export default router;
