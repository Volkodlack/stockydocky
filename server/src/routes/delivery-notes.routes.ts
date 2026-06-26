import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff } from '../middleware/roles';
import { applyMovement } from '../lib/stock';
import { streamDeliveryNotePdf } from '../lib/pdf';
import { badRequest, conflict, logAction, nextDocumentNumber, notFound } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  articleId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  clientId: z.string().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  date: z.string().optional(),
  signature: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Au moins un produit'),
});

const fullInclude = {
  client: true,
  user: { select: { name: true } },
  items: { include: { article: { select: { reference: true, name: true, brand: true } } } },
} satisfies Prisma.DeliveryNoteInclude;

// GET /api/delivery-notes — liste
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const where: Prisma.DeliveryNoteWhereInput = {};
    if (status && status !== 'all') where.status = status as Prisma.DeliveryNoteWhereInput['status'];

    const notes = await prisma.deliveryNote.findMany({
      where,
      include: { client: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(notes);
  }),
);

// GET /api/delivery-notes/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const note = await prisma.deliveryNote.findUnique({ where: { id: req.params.id }, include: fullInclude });
    if (!note) throw notFound('Bon de livraison introuvable');
    res.json(note);
  }),
);

// GET /api/delivery-notes/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const note = await prisma.deliveryNote.findUnique({ where: { id: req.params.id }, include: fullInclude });
    if (!note) throw notFound('Bon de livraison introuvable');
    streamDeliveryNotePdf(res, {
      number: note.number,
      date: note.date,
      status: note.status,
      address: note.address,
      notes: note.notes,
      signature: note.signature,
      client: note.client
        ? { name: note.client.name, email: note.client.email, phone: note.client.phone, address: note.client.address }
        : null,
      user: note.user,
      items: note.items.map((it) => ({
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        article: it.article,
      })),
    });
  }),
);

// POST /api/delivery-notes — création (brouillon)
router.post(
  '/',
  staff,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const number = await nextDocumentNumber('BL');

    // prix unitaire par défaut = prix de vente de l'article
    const articleIds = body.items.map((i) => i.articleId);
    const articles = await prisma.article.findMany({ where: { id: { in: articleIds } } });
    const priceMap = new Map(articles.map((a) => [a.id, Number(a.salePrice)]));

    const note = await prisma.deliveryNote.create({
      data: {
        number,
        clientId: body.clientId || null,
        address: body.address || null,
        notes: body.notes || null,
        signature: body.signature || null,
        date: body.date ? new Date(body.date) : new Date(),
        userId: req.user!.sub,
        items: {
          create: body.items.map((it) => ({
            articleId: it.articleId,
            quantity: it.quantity,
            unitPrice: it.unitPrice ?? priceMap.get(it.articleId) ?? 0,
          })),
        },
      },
      include: fullInclude,
    });

    await logAction(req.user!.sub, 'DELIVERY_CREATE', 'DeliveryNote', note.id, { number });
    res.status(201).json(note);
  }),
);

// POST /api/delivery-notes/:id/validate — valide et décrémente le stock
router.post(
  '/:id/validate',
  staff,
  asyncHandler(async (req, res) => {
    const note = await prisma.deliveryNote.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!note) throw notFound('Bon de livraison introuvable');
    if (note.status !== 'DRAFT') throw conflict('Seul un brouillon peut être validé');
    if (note.items.length === 0) throw badRequest('Bon de livraison vide');

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of note.items) {
        await applyMovement(tx, {
          articleId: item.articleId,
          type: 'DELIVERY_NOTE',
          quantity: -Math.abs(item.quantity),
          reason: `Bon de livraison ${note.number}`,
          reference: note.number,
          userId: req.user!.sub,
        });
      }
      return tx.deliveryNote.update({
        where: { id: note.id },
        data: { status: 'VALIDATED', signature: req.body?.signature ?? note.signature },
        include: fullInclude,
      });
    });

    await logAction(req.user!.sub, 'DELIVERY_VALIDATE', 'DeliveryNote', note.id, { number: note.number });
    res.json(updated);
  }),
);

// POST /api/delivery-notes/:id/signature — enregistre une signature
router.post(
  '/:id/signature',
  staff,
  asyncHandler(async (req, res) => {
    const signature = z.object({ signature: z.string().min(1) }).parse(req.body).signature;
    const note = await prisma.deliveryNote.update({
      where: { id: req.params.id },
      data: { signature },
      include: fullInclude,
    });
    res.json(note);
  }),
);

// DELETE /api/delivery-notes/:id — supprime un brouillon
router.delete(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const note = await prisma.deliveryNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw notFound();
    if (note.status === 'VALIDATED') throw conflict('Un bon validé ne peut pas être supprimé');
    await prisma.deliveryNote.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'DELIVERY_DELETE', 'DeliveryNote', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
