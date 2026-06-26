import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Boxes, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiError } from '../api/client';
import { Button, Field, Input } from '../components/ui';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-50 via-surface-50 to-brand-50 px-4 dark:from-surface-950 dark:via-surface-950 dark:to-surface-900">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <Boxes size={28} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">InventPro</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gestion de stock professionnelle</p>
        </div>

        <div className="card p-7">
          <h2 className="mb-1 font-display text-xl font-semibold text-slate-900 dark:text-white">Connexion</h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Accédez à votre espace de gestion.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <Field label="Adresse e-mail" htmlFor="email">
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className="pl-10"
                />
              </div>
            </Field>

            <Field label="Mot de passe" htmlFor="password">
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
            </Field>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              Se connecter <ArrowRight size={18} />
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          InventPro · Application de démonstration de gestion de stock
        </p>
      </div>
    </div>
  );
}
