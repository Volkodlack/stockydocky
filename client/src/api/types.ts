// Types partagés côté client (reflètent les réponses de l'API).

export type Role = 'ADMIN' | 'EMPLOYEE' | 'INVENTORY';

export type MovementType =
  | 'ENTRY_SIMPLE'
  | 'ENTRY_SUPPLIER'
  | 'ENTRY_IMPORT'
  | 'EXIT_SALE'
  | 'EXIT_BREAKAGE'
  | 'EXIT_LOSS'
  | 'EXIT_SAV'
  | 'EXIT_RETURN_SUPPLIER'
  | 'EXIT_CORRECTION'
  | 'DELIVERY_NOTE'
  | 'INVENTORY_ADJUSTMENT';

export type DeliveryStatus = 'DRAFT' | 'VALIDATED' | 'CANCELLED';
export type InventoryType = 'FULL' | 'ZONE' | 'ROLLING';
export type InventoryStatus = 'IN_PROGRESS' | 'VALIDATED' | 'CANCELLED';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Zone {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  _count?: { articles: number };
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  _count?: { articles: number };
}

export interface Supplier {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface Article {
  id: string;
  reference: string;
  barcode?: string | null;
  brand?: string | null;
  name: string;
  description?: string | null;
  purchasePrice: number | string;
  salePrice: number | string;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  zoneId?: string | null;
  categoryId?: string | null;
  zone?: Zone | null;
  category?: Category | null;
  movements?: StockMovement[];
}

export interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string | null;
  reference?: string | null;
  createdAt: string;
  articleId: string;
  article?: { id?: string; reference: string; name: string; brand?: string | null };
  user?: { name: string } | null;
  supplier?: { name: string } | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface DeliveryNoteItem {
  id: string;
  quantity: number;
  unitPrice: number | string;
  article?: { reference: string; name: string; brand?: string | null };
}

export interface DeliveryNote {
  id: string;
  number: string;
  date: string;
  address?: string | null;
  notes?: string | null;
  signature?: string | null;
  status: DeliveryStatus;
  client?: Client | { name: string } | null;
  user?: { name: string } | null;
  items?: DeliveryNoteItem[];
  _count?: { items: number };
}

export interface InventoryListItem {
  id: string;
  reference: string;
  type: InventoryType;
  status: InventoryStatus;
  notes?: string | null;
  createdAt: string;
  validatedAt?: string | null;
  zone?: { code: string } | null;
  user?: { name: string } | null;
  _count?: { items: number };
}

export interface InventoryRow {
  id: string;
  articleId: string;
  reference: string;
  name: string;
  brand?: string | null;
  zone?: string | null;
  theoreticalQty: number;
  countedQty: number | null;
  variance: number | null;
  varianceValue: number | null;
}

export interface InventoryDetail extends InventoryListItem {
  items: InventoryRow[];
}

export interface DashboardData {
  stats: {
    articleCount: number;
    outOfStock: number;
    lowStock: number;
    purchaseValue: number;
    saleValue: number;
    totalUnits: number;
  };
  monthly: Array<{ month: string; entries: number; exits: number }>;
  recentEntries: StockMovement[];
  recentExits: StockMovement[];
  alerts: Array<{ id: string; reference: string; name: string; stock: number; minStock: number }>;
}

export interface SearchResultArticle {
  id: string;
  reference: string;
  barcode?: string | null;
  brand?: string | null;
  name: string;
  stock: number;
  minStock: number;
  salePrice: number | string;
  zone?: { code: string } | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
}
