import { prisma } from '../config/prisma';
import type { MovementType } from '@prisma/client';

/** Erreur applicative avec code HTTP. */
export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Non authentifié') => new HttpError(401, msg);
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, msg);
export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Écrit une entrée dans le journal d'audit (best-effort, ne bloque jamais). */
export async function logAction(
  userId: string | undefined,
  action: string,
  entity?: string,
  entityId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId, details: details as object },
    });
  } catch {
    // on ignore les erreurs de journalisation
  }
}

/** Types d'entrée (quantité positive). */
export const ENTRY_TYPES: MovementType[] = ['ENTRY_SIMPLE', 'ENTRY_SUPPLIER', 'ENTRY_IMPORT'];

/** Types de sortie (quantité négative). */
export const EXIT_TYPES: MovementType[] = [
  'EXIT_SALE',
  'EXIT_BREAKAGE',
  'EXIT_LOSS',
  'EXIT_SAV',
  'EXIT_RETURN_SUPPLIER',
  'EXIT_CORRECTION',
];

/**
 * Génère un numéro de document séquentiel par année.
 * Ex : prefix "BL" -> "BL-2026-0001"
 */
export async function nextDocumentNumber(prefix: 'BL' | 'INV'): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-`;

  if (prefix === 'BL') {
    const last = await prisma.deliveryNote.findFirst({
      where: { number: { startsWith: like } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = last ? parseInt(last.number.split('-')[2], 10) + 1 : 1;
    return `${like}${String(seq).padStart(4, '0')}`;
  }

  const last = await prisma.inventory.findFirst({
    where: { reference: { startsWith: like } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `${like}${String(seq).padStart(4, '0')}`;
}
