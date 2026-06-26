import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  FileText,
  ClipboardList,
  MapPin,
  Tags,
  Truck,
  Users,
  UserCog,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../api/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[]; // rôles autorisés à voir l'entrée
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ['ADMIN', 'EMPLOYEE', 'INVENTORY'];
const STAFF: Role[] = ['ADMIN', 'EMPLOYEE'];
const ADMIN: Role[] = ['ADMIN'];
const INVENTORY: Role[] = ['ADMIN', 'INVENTORY'];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: ALL },
      { to: '/articles', label: 'Articles', icon: Package, roles: ALL },
    ],
  },
  {
    title: 'Mouvements',
    items: [
      { to: '/entrees', label: 'Entrées de stock', icon: ArrowDownToLine, roles: STAFF },
      { to: '/sorties', label: 'Sorties de stock', icon: ArrowUpFromLine, roles: STAFF },
      { to: '/mouvements', label: 'Historique', icon: ArrowLeftRight, roles: ALL },
      { to: '/bons-livraison', label: 'Bons de livraison', icon: FileText, roles: STAFF },
      { to: '/inventaires', label: 'Inventaires', icon: ClipboardList, roles: INVENTORY },
    ],
  },
  {
    title: 'Référentiels',
    items: [
      { to: '/zones', label: 'Zones', icon: MapPin, roles: STAFF },
      { to: '/categories', label: 'Catégories', icon: Tags, roles: STAFF },
      { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck, roles: STAFF },
      { to: '/clients', label: 'Clients', icon: Users, roles: STAFF },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs', icon: UserCog, roles: ADMIN },
      { to: '/journal', label: "Journal d'audit", icon: ScrollText, roles: ADMIN },
      { to: '/parametres', label: 'Paramètres & export', icon: Settings, roles: ALL },
    ],
  },
];

/** Filtre les sections/entrées visibles pour un rôle donné. */
export function navForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
