import type { Prisma, MovementType } from '@prisma/client';
import { badRequest, notFound } from '../utils/helpers';

export interface MovementInput {
  articleId: string;
  type: MovementType;
  /** Quantité signée : positive pour une entrée, négative pour une sortie. */
  quantity: number;
  reason?: string | null;
  reference?: string | null;
  userId?: string | null;
  supplierId?: string | null;
}

/**
 * Applique un mouvement de stock à l'intérieur d'une transaction Prisma :
 * met à jour le stock de l'article et journalise le mouvement (stockBefore/stockAfter).
 * À appeler obligatoirement via prisma.$transaction(...).
 */
export async function applyMovement(tx: Prisma.TransactionClient, input: MovementInput) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) {
    throw badRequest('La quantité du mouvement doit être un entier non nul');
  }

  const article = await tx.article.findUnique({ where: { id: input.articleId } });
  if (!article) throw notFound('Article introuvable');

  const stockBefore = article.stock;
  const stockAfter = stockBefore + input.quantity;

  if (stockAfter < 0) {
    throw badRequest(
      `Stock insuffisant pour « ${article.name} » (disponible : ${stockBefore}, demandé : ${Math.abs(
        input.quantity,
      )})`,
    );
  }

  await tx.article.update({
    where: { id: article.id },
    data: { stock: stockAfter },
  });

  const movement = await tx.stockMovement.create({
    data: {
      type: input.type,
      quantity: input.quantity,
      stockBefore,
      stockAfter,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      articleId: article.id,
      userId: input.userId ?? null,
      supplierId: input.supplierId ?? null,
    },
  });

  return { movement, stockBefore, stockAfter };
}
