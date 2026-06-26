import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MovementType, DeliveryStatus, InventoryStatus, InventoryType, Role } from '../api/types';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('fr-FR');

export const formatEur = (v: number | string | null | undefined): string =>
  eur.format(Number(v ?? 0));

export const formatNumber = (v: number | string | null | undefined): string =>
  num.format(Number(v ?? 0));

export const formatDate = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return format(d, 'dd/MM/yyyy', { locale: fr });
};

export const formatDateTime = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return format(d, 'dd/MM/yyyy à HH:mm', { locale: fr });
};

export const timeAgo = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatDistanceToNow(d, { locale: fr, addSuffix: true });
};

// ───────────── Libellés des types de mouvement ─────────────
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRY_SIMPLE: 'Entrée simple',
  ENTRY_SUPPLIER: 'Réception fournisseur',
  ENTRY_IMPORT: 'Import',
  EXIT_SALE: 'Vente',
  EXIT_BREAKAGE: 'Casse',
  EXIT_LOSS: 'Perte',
  EXIT_SAV: 'SAV',
  EXIT_RETURN_SUPPLIER: 'Retour fournisseur',
  EXIT_CORRECTION: 'Correction',
  DELIVERY_NOTE: 'Bon de livraison',
  INVENTORY_ADJUSTMENT: 'Régularisation inventaire',
};

export const ENTRY_REASONS: { value: MovementType; label: string }[] = [
  { value: 'ENTRY_SIMPLE', label: 'Entrée simple' },
  { value: 'ENTRY_SUPPLIER', label: 'Réception fournisseur' },
];

export const EXIT_REASONS: { value: MovementType; label: string }[] = [
  { value: 'EXIT_SALE', label: 'Vente' },
  { value: 'EXIT_BREAKAGE', label: 'Casse' },
  { value: 'EXIT_LOSS', label: 'Perte' },
  { value: 'EXIT_SAV', label: 'SAV' },
  { value: 'EXIT_RETURN_SUPPLIER', label: 'Retour fournisseur' },
];

export const isEntry = (t: MovementType) =>
  t.startsWith('ENTRY') || t === 'INVENTORY_ADJUSTMENT' || t === 'EXIT_CORRECTION';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
  CANCELLED: 'Annulé',
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  IN_PROGRESS: 'En cours',
  VALIDATED: 'Validé',
  CANCELLED: 'Annulé',
};

export const INVENTORY_TYPE_LABELS: Record<InventoryType, string> = {
  FULL: 'Complet',
  ZONE: 'Par zone',
  ROLLING: 'Tournant',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  EMPLOYEE: 'Employé',
  INVENTORY: 'Inventaire',
};

export type StockStatus = 'ok' | 'low' | 'out';

export const stockStatus = (stock: number, minStock: number): StockStatus => {
  if (stock <= 0) return 'out';
  if (stock <= minStock) return 'low';
  return 'ok';
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'En stock',
  low: 'Stock bas',
  out: 'Rupture',
};
