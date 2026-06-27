import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Sun,
  Moon,
  ScanLine,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../hooks/useToast';
import { api, apiError } from '../../api/client';
import { ROLE_LABELS } from '../../lib/format';
import { navForRole } from './nav';
import { GlobalSearch } from './GlobalSearch';
import { ScannerModal } from '../scanner/ScannerModal';
import { QuickAddArticleModal } from '../articles/QuickAddArticleModal';
import { useBarcodeWedge } from '../../hooks/useBarcodeWedge';

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [quickAddCode, setQuickAddCode] = useState<string | null>(null);
  const [userMenu, setUserMenu] = useState(false);

  const sections = user ? navForRole(user.role) : [];

  // Ferme le drawer mobile à chaque navigation
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenu(false);
  }, [location.pathname]);

  // Recherche d'un article par code-barres (caméra OU douchette)
  const lookupBarcode = async (code: string) => {
    try {
      const res = await api.get(`/articles/barcode/${encodeURIComponent(code)}`);
      navigate(`/articles/${res.data.id}`);
      toast.success(`Article trouvé : ${res.data.name}`);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // Article inconnu : proposer la création directe (gestionnaires uniquement)
        if (hasRole('ADMIN', 'EMPLOYEE')) {
          setScanOpen(false);
          setQuickAddCode(code);
        } else {
          toast.error(`Article inconnu (code ${code}).`);
        }
      } else {
        toast.error(apiError(e));
      }
    }
  };

  const onScanDetected = (code: string) => {
    setScanOpen(false);
    void lookupBarcode(code);
  };

  // Douchette active globalement (sauf quand un scan ou la création est en cours)
  useBarcodeWedge({ onScan: lookupBarcode, enabled: !scanOpen && !quickAddCode });

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* ───────────── Sidebar ───────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-surface-900 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5 dark:border-slate-800">
          <img src="/favicon.svg" alt="Carles" className="h-9 w-9" />
          <div>
            <p className="font-display text-lg font-bold leading-none tracking-tight text-slate-900 dark:text-white">
              Carles
            </p>
            <p className="text-[11px] font-medium tracking-wide text-accent-600 dark:text-accent-400">Inventaire</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-surface-800"
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="h-[calc(100vh-4rem)] space-y-6 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-800'
                        }`
                      }
                    >
                      <Icon size={18} className="shrink-0" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ───────────── Contenu ───────────── */}
      <div className="lg:pl-72">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-surface-900/80 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-surface-800"
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>

          <div className="hidden flex-1 sm:block">
            <GlobalSearch />
          </div>
          <div className="flex-1 sm:hidden" />

          {/* Scan */}
          <button
            onClick={() => setScanOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent-600 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-700"
            aria-label="Scanner"
          >
            <ScanLine size={18} />
            <span className="hidden md:inline">Scanner</span>
          </button>

          {/* Thème */}
          <button
            onClick={toggle}
            className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-surface-800"
            aria-label="Changer de thème"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Menu utilisateur */}
          <div className="relative">
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition hover:bg-slate-100 dark:hover:bg-surface-800"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/10 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {initials}
              </span>
              <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 z-20 mt-2 w-56 animate-scale-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft dark:border-slate-800 dark:bg-surface-900">
                  <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                    <p className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      {user ? ROLE_LABELS[user.role] : ''}
                    </p>
                  </div>
                  <button
                    onClick={logout}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut size={16} /> Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Recherche mobile (sous la topbar) */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-surface-900 sm:hidden">
          <GlobalSearch />
        </div>

        {/* Page */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <ScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onScanDetected} />

      <QuickAddArticleModal
        open={!!quickAddCode}
        barcode={quickAddCode ?? ''}
        onClose={() => setQuickAddCode(null)}
        onCreated={(article) => {
          setQuickAddCode(null);
          navigate(`/articles/${article.id}`);
        }}
      />
    </div>
  );
}
