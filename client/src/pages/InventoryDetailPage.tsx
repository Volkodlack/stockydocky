import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ClipboardList,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { api, apiError } from '../api/client';
import type { InventoryDetail, InventoryStatus } from '../api/types';
import { formatEur, formatDate, INVENTORY_STATUS_LABELS, INVENTORY_TYPE_LABELS } from '../lib/format';
import { useToast } from '../hooks/useToast';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  PageLoader,
  StatCard,
  useConfirm,
} from '../components/ui';

const STATUS_COLORS: Record<InventoryStatus, 'amber' | 'green' | 'red'> = {
  IN_PROGRESS: 'amber',
  VALIDATED: 'green',
  CANCELLED: 'red',
};

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [inv, setInv] = useState<InventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/inventory/${id}`)
      .then((res) => {
        const data: InventoryDetail = res.data;
        setInv(data);
        // pré-remplit les comptages déjà saisis
        const initial: Record<string, string> = {};
        data.items.forEach((it) => {
          if (it.countedQty !== null) initial[it.articleId] = String(it.countedQty);
        });
        setCounts(initial);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = inv?.status === 'IN_PROGRESS';

  // Lignes enrichies avec écart live (basé sur la saisie en cours)
  const rows = useMemo(() => {
    if (!inv) return [];
    return inv.items.map((it) => {
      const raw = counts[it.articleId];
      const counted = raw === undefined || raw === '' ? null : Number(raw);
      const variance = counted === null ? null : counted - it.theoreticalQty;
      return { ...it, liveCounted: counted, liveVariance: variance };
    });
  }, [inv, counts]);

  const summary = useMemo(() => {
    let countedLines = 0;
    let missing = 0;
    let surplus = 0;
    let varianceValue = 0;
    rows.forEach((r) => {
      if (r.liveCounted === null) return;
      countedLines++;
      if (r.liveVariance && r.liveVariance < 0) missing++;
      if (r.liveVariance && r.liveVariance > 0) surplus++;
      const purchase = r.varianceValue !== null && r.variance ? r.varianceValue / r.variance : 0;
      if (r.liveVariance) varianceValue += r.liveVariance * purchase;
    });
    return { countedLines, missing, surplus, varianceValue, total: rows.length };
  }, [rows]);

  const setCount = (articleId: string, value: string) =>
    setCounts((prev) => ({ ...prev, [articleId]: value }));

  const fillTheoretical = () => {
    if (!inv) return;
    const next: Record<string, string> = { ...counts };
    inv.items.forEach((it) => {
      if (next[it.articleId] === undefined || next[it.articleId] === '')
        next[it.articleId] = String(it.theoreticalQty);
    });
    setCounts(next);
  };

  const saveCounts = async () => {
    if (!id) return;
    const payload = Object.entries(counts)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([articleId, v]) => ({ articleId, countedQty: Number(v) }));
    if (payload.length === 0) {
      toast.error('Saisissez au moins une quantité.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/inventory/${id}/count`, { counts: payload });
      toast.success('Comptages enregistrés.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const validate = async () => {
    if (!id) return;
    const ok = await confirm({
      title: "Valider l'inventaire",
      message:
        'La validation enregistre les comptages restants et régularise le stock selon les écarts constatés. Cette action est définitive.',
      confirmLabel: 'Valider et régulariser',
    });
    if (!ok) return;
    setValidating(true);
    try {
      // enregistre d'abord les comptages en cours
      const payload = Object.entries(counts)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([articleId, v]) => ({ articleId, countedQty: Number(v) }));
      if (payload.length > 0) {
        await api.put(`/inventory/${id}/count`, { counts: payload });
      }
      const res = await api.post(`/inventory/${id}/validate`);
      toast.success(`Inventaire validé — ${res.data.adjustments} régularisation(s).`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setValidating(false);
    }
  };

  if (loading || !inv) {
    return (
      <div>
        <Link to="/inventaires" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
          <ArrowLeft size={16} /> Inventaires
        </Link>
        <PageLoader />
      </div>
    );
  }

  return (
    <div>
      <Link to="/inventaires" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Inventaires
      </Link>

      <PageHeader
        title={inv.reference}
        subtitle={`${INVENTORY_TYPE_LABELS[inv.type]}${inv.zone ? ` · zone ${inv.zone.code}` : ''} · ${formatDate(inv.createdAt)}`}
        icon={<ClipboardList size={22} />}
        actions={<Badge color={STATUS_COLORS[inv.status]}>{INVENTORY_STATUS_LABELS[inv.status]}</Badge>}
      />

      {/* Synthèse */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Articles comptés" value={`${summary.countedLines}/${summary.total}`} tone="brand" icon={<ClipboardList size={20} />} />
        <StatCard label="Manquants" value={summary.missing} tone="red" icon={<TrendingDown size={20} />} />
        <StatCard label="Excédents" value={summary.surplus} tone="green" icon={<TrendingUp size={20} />} />
        <StatCard
          label="Valeur écart"
          value={formatEur(summary.varianceValue)}
          tone={summary.varianceValue < 0 ? 'red' : 'slate'}
          icon={<AlertTriangle size={20} />}
        />
      </div>

      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fillTheoretical}>
            Pré-remplir au stock théorique
          </Button>
          <Button variant="secondary" size="sm" onClick={saveCounts} loading={saving}>
            <Save size={16} /> Enregistrer les comptages
          </Button>
          <Button size="sm" onClick={validate} loading={validating}>
            <CheckCircle2 size={16} /> Valider l'inventaire
          </Button>
        </div>
      )}

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <th className="px-4 py-3 font-medium">Article</th>
                <th className="px-4 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 text-center font-medium">Théorique</th>
                <th className="px-4 py-3 text-center font-medium">Compté</th>
                <th className="px-4 py-3 text-center font-medium">Écart</th>
                <th className="px-4 py-3 text-right font-medium">Valeur écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const purchase = r.varianceValue !== null && r.variance ? r.varianceValue / r.variance : 0;
                const liveValue = r.liveVariance ? r.liveVariance * purchase : 0;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r.reference}
                        {r.brand ? ` · ${r.brand}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{r.zone ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                      {r.theoreticalQty}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {editable ? (
                        <input
                          type="number"
                          min={0}
                          value={counts[r.articleId] ?? ''}
                          onChange={(e) => setCount(r.articleId, e.target.value)}
                          placeholder="—"
                          className="field h-9 w-20 text-center"
                          aria-label={`Quantité comptée ${r.reference}`}
                        />
                      ) : (
                        <span className="tabular-nums text-slate-700 dark:text-slate-200">
                          {r.countedQty ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.liveVariance === null ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : r.liveVariance === 0 ? (
                        <Badge color="green">0</Badge>
                      ) : r.liveVariance > 0 ? (
                        <Badge color="blue">+{r.liveVariance}</Badge>
                      ) : (
                        <Badge color="red">{r.liveVariance}</Badge>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        liveValue < 0
                          ? 'text-red-600 dark:text-red-400'
                          : liveValue > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {r.liveVariance === null ? '—' : formatEur(liveValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {inv.status === 'VALIDATED' && (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} /> Inventaire validé{inv.validatedAt ? ` le ${formatDate(inv.validatedAt)}` : ''}. Le
          stock a été régularisé.
        </p>
      )}

      {dialog}
    </div>
  );
}
