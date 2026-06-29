import { useState, useRef } from 'react';
import {
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Sun,
  Moon,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api, apiError, downloadFile } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/useToast';
import { ROLE_LABELS } from '../lib/format';
import { PageHeader, Card, Button, Badge } from '../components/ui';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  stockAdded: number;
  errors: string[];
}

export function SettingsPage() {
  const { user, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const canImport = hasRole('ADMIN', 'EMPLOYEE');

  const [busy, setBusy] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async (path: string, filename: string, key: string) => {
    setBusy(key);
    try {
      await downloadFile(path, filename);
      toast.success('Export téléchargé.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/import/articles', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      toast.success(`Import terminé : ${res.data.created} créé(s), ${res.data.updated} mis à jour.`);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <PageHeader title="Paramètres & export" subtitle="Préférences, sauvegardes et imports" icon={<Settings size={22} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Compte */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <UserIcon size={18} className="text-brand-600" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Mon compte</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Nom</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Identifiant</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user?.username}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Rôle</dt>
              <dd>
                <Badge color="brand">{user ? ROLE_LABELS[user.role] : ''}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        {/* Apparence */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            {theme === 'dark' ? <Moon size={18} className="text-brand-600" /> : <Sun size={18} className="text-brand-600" />}
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Apparence</h2>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Thème sombre</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bascule entre clair et sombre.</p>
            </div>
            <Button variant="outline" onClick={toggle}>
              {theme === 'dark' ? (
                <>
                  <Sun size={16} /> Clair
                </>
              ) : (
                <>
                  <Moon size={16} /> Sombre
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Exports */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Download size={18} className="text-brand-600" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Exports & sauvegardes</h2>
          </div>
          <div className="space-y-2.5">
            <ExportRow
              icon={<FileSpreadsheet size={18} className="text-emerald-600" />}
              label="Articles (Excel)"
              desc="Catalogue complet au format .xlsx"
              loading={busy === 'xlsx'}
              onClick={() => doExport('/export/articles.xlsx', 'articles.xlsx', 'xlsx')}
            />
            <ExportRow
              icon={<FileText size={18} className="text-slate-500" />}
              label="Articles (CSV)"
              desc="Catalogue au format .csv"
              loading={busy === 'csv'}
              onClick={() => doExport('/export/articles.csv', 'articles.csv', 'csv')}
            />
            <ExportRow
              icon={<FileText size={18} className="text-amber-600" />}
              label="Mouvements (CSV)"
              desc="Historique complet des mouvements"
              loading={busy === 'mov'}
              onClick={() => doExport('/export/movements.csv', 'mouvements.csv', 'mov')}
            />
          </div>
        </Card>

        {/* Import */}
        {canImport && (
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Upload size={18} className="text-brand-600" />
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Importer des articles</h2>
            </div>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Fichier CSV avec en-têtes :{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-surface-800">
                reference, barcode, brand, name, description, purchasePrice, salePrice, stock, minStock, zone, category
              </code>
              . La colonne <strong>stock</strong> est ajoutée comme entrée tracée.
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} loading={importing} fullWidth>
              <Upload size={18} /> Choisir un fichier CSV
            </Button>

            {result && (
              <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} /> Import terminé
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Lignes" value={result.total} />
                  <Stat label="Créés" value={result.created} />
                  <Stat label="Mis à jour" value={result.updated} />
                  <Stat label="Stock ajouté" value={result.stockAdded} />
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-3 rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                      <AlertCircle size={14} /> {result.errors.length} erreur(s)
                    </p>
                    <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <li key={i}>· {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ExportRow({
  icon,
  label,
  desc,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-60 dark:border-slate-800 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <Download size={16} className="shrink-0 text-slate-400" />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-surface-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
