import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { adminOnly } from '../middleware/roles';

const router = Router();
router.use(authenticate, adminOnly);

// GET /api/audit — journal des actions sensibles
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) ?? '50', 10)));
    const action = req.query.action as string | undefined;

    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  }),
);

export default router;
