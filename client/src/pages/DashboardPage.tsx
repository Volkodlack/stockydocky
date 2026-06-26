import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Package,
  AlertTriangle,
  XCircle,
  Coins,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
} from 'lucide-react';
import { api, apiError } from '../api/client';
import type { DashboardData } from '../api/types';
import { formatEur, formatNumber, formatDate, MOVEMENT_LABELS } from '../lib/format';
import { useTheme } from '../contexts/ThemeContext';
import { PageHeader, StatCard, Card, PageLoader, EmptyState, Badge } from '../components/ui';

export function DashboardPage() {
  const { theme } = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .catch((e) => setError(apiError(e)));
  }, []);

  if (error) return <EmptyState icon={<XCircle size={40} />} title="Erreur de chargement" description={error} />;
  if (!data) return <PageLoader />;

  const grid = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const axis = theme === 'dark' ? '#64748b' : '#94a3b8';

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre stock" icon={<TrendingUp size={22} />} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Articles actifs" value={formatNumber(data.stats.articleCount)} icon={<Package size={22} />} tone="brand" />
        <StatCard label="Unités en stock" value={formatNumber(data.stats.totalUnits)} icon={<Layers size={22} />} tone="slate" />
        <StatCard
          label="Valeur d'achat du stock"
          value={formatEur(data.stats.purchaseValue)}
          hint={`Valeur de vente : ${formatEur(data.stats.saleValue)}`}
          icon={<Coins size={22} />}
          tone="green"
        />
        <StatCard label="Stock bas" value={formatNumber(data.stats.lowStock)} icon={<AlertTriangle size={22} />} tone="amber" />
        <StatCard label="Ruptures" value={formatNumber(data.stats.outOfStock)} icon={<XCircle size={22} />} tone="red" />
        <StatCard
          label="Marge potentielle"
          value={formatEur(Number(data.stats.saleValue) - Number(data.stats.purchaseValue))}
          icon={<TrendingUp size={22} />}
          tone="brand"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Graphique mouvements */}
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-semibold text-slate-900 dark:text-white">
            Mouvements des 6 derniers mois
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="month" stroke={axis} fontSize={12} tickLine={false} axisLine={{ stroke: grid }} />
                <YAxis stroke={axis} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: theme === 'dark' ? '#0f172a' : '#fff',
                    border: `1px solid ${grid}`,
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                  cursor={{ fill: theme === 'dark' ? '#1e293b55' : '#f1f5f9' }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="entries" name="Entrées" fill="#523996" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exits" name="Sorties" fill="#d40c5b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Alertes stock */}
        <Card padding={false}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Alertes stock</h2>
            <Badge color="amber">{data.alerts.length}</Badge>
          </div>
          {data.alerts.length === 0 ? (
            <EmptyState icon={<Package size={32} />} title="Aucune alerte" description="Tous les stocks sont au-dessus du seuil." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.alerts.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/articles/${a.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-surface-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{a.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{a.reference}</p>
                    </div>
                    <Badge color={a.stock <= 0 ? 'red' : 'amber'}>
                      {a.stock} / {a.minStock}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Derniers mouvements */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentList title="Dernières entrées" icon={<ArrowDownToLine size={18} className="text-emerald-500" />} items={data.recentEntries} positive />
        <RecentList title="Dernières sorties" icon={<ArrowUpFromLine size={18} className="text-amber-500" />} items={data.recentExits} />
      </div>
    </div>
  );
}

function RecentList({
  title,
  icon,
  items,
  positive,
}: {
  title: string;
  icon: React.ReactNode;
  items: DashboardData['recentEntries'];
  positive?: boolean;
}) {
  return (
    <Card padding={false}>
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        {icon}
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Aucun mouvement" description="Les mouvements récents apparaîtront ici." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {m.article?.name ?? '—'}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {MOVEMENT_LABELS[m.type]} · {formatDate(m.createdAt)}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {positive ? '+' : ''}
                {m.quantity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
