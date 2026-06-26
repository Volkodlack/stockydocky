import { useNavigate } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button } from '../components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <Compass size={32} />
      </div>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Page introuvable</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">La page demandée n'existe pas ou a été déplacée.</p>
      </div>
      <Button onClick={() => navigate('/')}>
        <Home size={18} /> Retour au tableau de bord
      </Button>
    </div>
  );
}
