import { Truck } from 'lucide-react';
import { makeReferentialPage } from '../components/referential/ReferentialPage';

export const SuppliersPage = makeReferentialPage({
  endpoint: '/suppliers',
  title: 'Fournisseurs',
  subtitle: 'Partenaires d\u2019approvisionnement',
  icon: Truck,
  singular: 'Fournisseur',
  primaryKey: 'name',
  fields: [
    { key: 'name', label: 'Nom', required: true, placeholder: 'Luxottica France' },
    { key: 'email', label: 'E-mail', type: 'email', placeholder: 'contact@fournisseur.fr', showInList: true },
    { key: 'phone', label: 'T\u00e9l\u00e9phone', type: 'tel', placeholder: '01 23 45 67 89', showInList: true },
    { key: 'address', label: 'Adresse', placeholder: 'Adresse postale', showInList: true },
  ],
});
