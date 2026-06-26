import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Filter, X, Download } from 'lucide-react';
import { api, apiError, downloadFile } from '../api/client';
import type { StockMovement, Paginated, Zone, MovementType } from '../api/types';
import { formatDateTime, MOVEMENT_LABELS, isEntry } from '../lib/format';
import { useToast } from '../hooks/useToast';
import { PageHeader, Card, Button, Select, Field, Input, Pagination, PageLoader, EmptyState, Badge } from '../components/ui';

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'ENTRY', label: 'Toutes les entrées' },
  { value: 'EXIT', label: 'Toutes les sorties' },
  { value: 'ENTRY_SIMPLE', label: 'Entrée simple' },
  { value: 'ENTRY_SUPPLIER', label: 'Réception fournisseur' },
  { value: 'ENTRY_IMPORT', label: 'Import' },
  { value: 'EXIT_SALE', label: 'Vente' },
  { value: 'EXIT_BREAKAGE', label: 'Casse' },
  { value: 'EXIT_LOSS', label: 'Perte' },
  { value: 'EXIT_SAV', label: 'SAV' },
  { value: 'EXIT_RETURN_SUPPLIER', label: 'Retour fournisseur' },
  { value: 'DELIVERY_NOTE', label: 'Bon de livraison' },
  { value: 'INVENTORY_ADJUSTMENT', label: 'Régularisation inventaire' },
];

export function MovementsPage() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<StockMovement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);

  const [type, setType] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/movements', {
        params: {
          type: type || undefined,
          zoneId: zoneId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          pageSize: 25,
        },
      })
      .then((res) => setData(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [type, zoneId, dateFrom, dateTo, page, toast]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    api.get('/zones').then((r) => setZones(r.data)).catch(() => {});
  }, []);
  useEffect(() => setPage(1), [type, zoneId, dateFrom, dateTo]);

  const exportCsv = async () => {
    try {
      await downloadFile('/export/movements.csv', 'mouvements.csv');
      toast.success('Export téléchargé.');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const resetFilters = () => {
    setType('');
    setZoneId('');
    setDateFrom('');
    setDateTo('');
  };
  const hasActive = type || zoneId || dateFrom || dateTo;

  return (
    <div>
      <PageHeader
        title="Historique des mouvements"
        subtitle={data ? `${data.total} mouvement(s)` : 'Journal des entrées et sorties'}
        icon={<ArrowLeftRight size={22} />}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
              <Filter size={16} /> Filtres {hasActive ? <span className="ml-1 h-2 w-2 rounded-full bg-brand-500" /> : null}
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={16} /> <span className="hidden sm:inline">Exporter</span>
            </Button>
          </>
        }
      />

      {showFilters && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type de mouvement">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Zone">
              <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="">Toutes</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Du">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Field>
            <Field label="Au">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Field>
          </div>
          {hasActive && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={resetFilters}>
              <X size={14} /> Réinitialiser
            </Button>
          )}
        </Card>
      )}

      <Card padding={false}>
        {loading ? (
          <PageLoader />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={40} />} title="Aucun mouvement" description="Aucun mouvement ne correspond aux critères." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Article</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Utilisateur</th>
                    <th className="px-5 py-3 text-right font-semibold">Quantité</th>
                    <th className="px-5 py-3 text-right font-semibold">Stock après</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((m) => (
                    <tr key={m.id} className="transition hover:bg-slate-50 dark:hover:bg-surface-800">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(m.createdAt)}</td>
                      <td className="px-5 py-3">
                        {m.article ? (
                          <Link to={`/articles/${m.articleId}`} className="font-medium text-slate-800 hover:text-brand-600 dark:text-slate-100">
                            {m.article.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <p className="font-mono text-xs text-slate-400">{m.article?.reference}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge color={isEntry(m.type) ? 'green' : 'amber'}>{MOVEMENT_LABELS[m.type]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{m.user?.name ?? '—'}</td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${m.quantity >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {m.quantity >= 0 ? '+' : ''}
                        {m.quantity}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{m.stockAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {data.items.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isEntry(m.type) ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {isEntry(m.type) ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{m.article?.name ?? '—'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {MOVEMENT_LABELS[m.type]} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${m.quantity >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {m.quantity >= 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </li>
              ))}
            </ul>

            <div className="px-5 pb-4">
              <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
