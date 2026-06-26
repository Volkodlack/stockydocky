import { MapPin } from 'lucide-react';
import { makeReferentialPage } from '../components/referential/ReferentialPage';

export const ZonesPage = makeReferentialPage({
  endpoint: '/zones',
  title: 'Zones',
  subtitle: 'Emplacements de stockage',
  icon: MapPin,
  singular: 'Zone',
  primaryKey: 'code',
  showArticleCount: true,
  fields: [
    { key: 'code', label: 'Code', required: true, uppercase: true, placeholder: 'A1-01' },
    { key: 'name', label: 'Nom', placeholder: 'Allée 1 · Rayon haut', showInList: true },
    { key: 'description', label: 'Description', placeholder: 'Précisions optionnelles', showInList: true },
  ],
});
