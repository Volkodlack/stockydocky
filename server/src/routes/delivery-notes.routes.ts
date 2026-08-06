import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff } from '../middleware/roles';
import { applyMovement } from '../lib/stock';
import { streamDeliveryNotePdf } from '../lib/pdf';
import { badRequest, conflict, logAction, nextDocumentNumber, notFound } from '../utils/helpers';

/**
 * « Bons de livraison » = RÉCEPTIONS fournisseur.
 * On enregistre les produits livrés par un fournisseur (d'après son bon de
 * livraison) ; la validation FAIT ENTRER le stock (mouvement ENTRY_SUPPLIER).
 */

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  articleId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  supplierId: z.string().optional().nullable(),
  supplierRef: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  date: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins un produit'),
});

const fullInclude = {
  supplier: true,
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
      include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
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
      supplierRef: note.supplierRef,
      notes: note.notes,
      supplier: note.supplier
        ? {
            name: note.supplier.name,
            email: note.supplier.email,
            phone: note.supplier.phone,
            address: note.supplier.address,
          }
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

    // prix unitaire par défaut = prix d'ACHAT de l'article (réception fournisseur)
    const articleIds = body.items.map((i) => i.articleId);
    const articles = await prisma.article.findMany({ where: { id: { in: articleIds } } });
    const priceMap = new Map(articles.map((a) => [a.id, Number(a.purchasePrice)]));

    const note = await prisma.deliveryNote.create({
      data: {
        number,
        supplierId: body.supplierId || null,
        supplierRef: body.supplierRef || null,
        notes: body.notes || null,
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

    await logAction(req.user!.sub, 'RECEPTION_CREATE', 'DeliveryNote', note.id, { number });
    res.status(201).json(note);
  }),
);

// POST /api/delivery-notes/:id/validate — valide et FAIT ENTRER le stock
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
          type: 'ENTRY_SUPPLIER',
          quantity: Math.abs(item.quantity), // entrée : quantité positive
          reason: `Réception ${note.number}`,
          reference: note.supplierRef ?? note.number,
          userId: req.user!.sub,
          supplierId: note.supplierId,
        });
      }
      return tx.deliveryNote.update({
        where: { id: note.id },
        data: { status: 'VALIDATED' },
        include: fullInclude,
      });
    });

    await logAction(req.user!.sub, 'RECEPTION_VALIDATE', 'DeliveryNote', note.id, { number: note.number });
    res.json(updated);
  }),
);

// DELETE /api/delivery-notes/:id — supprime un brouillon
router.delete(
  '/:id',
  staff,
  asyncHandler(async (req, res) => {
    const note = await prisma.deliveryNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw notFound();
    if (note.status === 'VALIDATED') throw conflict('Une réception validée ne peut pas être supprimée');
    await prisma.deliveryNote.delete({ where: { id: req.params.id } });
    await logAction(req.user!.sub, 'RECEPTION_DELETE', 'DeliveryNote', req.params.id);
    res.json({ deleted: true });
  }),
);

export default router;
