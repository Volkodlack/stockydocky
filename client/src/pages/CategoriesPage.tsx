import { Tags } from 'lucide-react';
import { makeReferentialPage } from '../components/referential/ReferentialPage';

export const CategoriesPage = makeReferentialPage({
  endpoint: '/categories',
  title: 'Catégories',
  subtitle: 'Familles de produits',
  icon: Tags,
  singular: 'Catégorie',
  primaryKey: 'name',
  showArticleCount: true,
  fields: [
    { key: 'name', label: 'Nom', required: true, placeholder: 'Lunettes de vue' },
    { key: 'description', label: 'Description', placeholder: 'Précisions optionnelles', showInList: true },
  ],
});
