import { useEffect, useState, useCallback } from 'react';
import { ScrollText, Filter } from 'lucide-react';
import { api, apiError } from '../api/client';
import type { AuditEntry, Paginated } from '../api/types';
import { formatDateTime } from '../lib/format';
import { useToast } from '../hooks/useToast';
import { PageHeader, Card, Input, Field, Pagination, PageLoader, EmptyState, Badge } from '../components/ui';

const ACTION_COLORS: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'gray'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'brand',
  ENTRY: 'green',
  EXIT: 'amber',
  ADJUST: 'amber',
  VALIDATE: 'brand',
  IMPORT: 'blue',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'gray';
}

export function AuditPage() {
  const toast = useToast();
  const [data, setData] = useState<Paginated<AuditEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/audit', { params: { action: action || undefined, page, pageSize: 30 } })
      .then((res) => setData(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [action, page, toast]);

  useEffect(() => load(), [load]);
  useEffect(() => setPage(1), [action]);

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        subtitle={data ? `${data.total} événement(s) enregistré(s)` : "Traçabilité des actions"}
        icon={<ScrollText size={22} />}
      />

      <Card className="mb-4">
        <Field label="Filtrer par action">
          <div className="relative">
            <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ex. CREATE, DELETE, LOGIN, ENTRY…"
              className="pl-9"
            />
          </div>
        </Field>
      </Card>

      <Card padding={false}>
        {loading ? (
          <PageLoader />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={<ScrollText size={40} />} title="Aucun événement" description="Le journal est vide ou aucun résultat ne correspond." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.items.map((e) => (
                <li key={e.id} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={actionColor(e.action)}>{e.action}</Badge>
                      {e.entity && <span className="text-xs text-slate-500 dark:text-slate-400">{e.entity}</span>}
                    </div>
                    {e.details && (
                      <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                        {JSON.stringify(e.details)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{e.user?.name ?? 'Système'}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(e.createdAt)}</p>
                  </div>
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
