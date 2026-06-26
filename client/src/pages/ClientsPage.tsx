import { Users } from 'lucide-react';
import { makeReferentialPage } from '../components/referential/ReferentialPage';

export const ClientsPage = makeReferentialPage({
  endpoint: '/clients',
  title: 'Clients',
  subtitle: 'Destinataires des bons de livraison',
  icon: Users,
  singular: 'Client',
  primaryKey: 'name',
  fields: [
    { key: 'name', label: 'Nom', required: true, placeholder: 'Cabinet Optique Martin' },
    { key: 'email', label: 'E-mail', type: 'email', placeholder: 'client@exemple.fr', showInList: true },
    { key: 'phone', label: 'T\u00e9l\u00e9phone', type: 'tel', placeholder: '01 23 45 67 89', showInList: true },
    { key: 'address', label: 'Adresse', placeholder: 'Adresse de livraison', showInList: true },
  ],
});
