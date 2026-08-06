import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff } from '../middleware/roles';
import { badRequest, logAction, notFound, isAdminReq, omitSalePrice } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const transferSchema = z.object({
  articleId: z.string().min(1, 'Article requis'),
  zoneId: z.string().min(1, 'Zone de destination requise'),
});

// POST /api/transfers — déplace un article vers une autre zone
router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const { articleId, zoneId } = transferSchema.parse(req.body);

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { zone: true },
    });
    if (!article) throw notFound('Article introuvable');

    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw notFound('Zone introuvable');

    if (article.zoneId === zoneId) {
      throw badRequest("L'article est déjà dans cette zone");
    }

    const fromCode = article.zone?.code ?? null;

    const updated = await prisma.article.update({
      where: { id: articleId },
      data: { zoneId },
      include: { zone: true, category: true },
    });

    await logAction(req.user!.sub, 'ZONE_TRANSFER', 'Article', articleId, {
      reference: article.reference,
      from: fromCode,
      to: zone.code,
    });

    res.json(omitSalePrice(updated, isAdminReq(req)));
  }),
);

export default router;
