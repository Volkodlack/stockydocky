import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Pencil,
  Trash2,
  SlidersHorizontal,
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  MapPin,
  Tag,
} from 'lucide-react';
import { api, apiError } from '../api/client';
import type { Article } from '../api/types';
import { formatEur, formatDateTime, MOVEMENT_LABELS, isEntry, stockStatus, STOCK_STATUS_LABELS } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { Button, Card, Modal, Field, Input, Textarea, PageLoader, EmptyState, Badge, useConfirm } from '../components/ui';

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const toast = useToast();
  const canEdit = hasRole('ADMIN', 'EMPLOYEE');
  const canDelete = hasRole('ADMIN', 'EMPLOYEE');
  const { confirm, dialog } = useConfirm();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [newStock, setNewStock] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/articles/${id}`)
      .then((res) => setArticle(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => load(), [load]);

  const openAdjust = () => {
    if (!article) return;
    setNewStock(article.stock);
    setReason('');
    setAdjustOpen(true);
  };

  const saveAdjust = async () => {
    if (!article) return;
    setSaving(true);
    try {
      await api.post('/movements/adjust', {
        articleId: article.id,
        newStock: Number(newStock),
        reason: reason.trim() || undefined,
      });
      toast.success('Stock ajusté.');
      setAdjustOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!article) return;
    const ok = await confirm({
      title: 'Supprimer cet article',
      message: `Voulez-vous vraiment supprimer « ${article.name} » ? Si des mouvements existent, l\u2019article sera désactivé (historique conservé).`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/articles/${article.id}`);
      if (res.data?.deactivated) {
        toast.info('Article désactivé : des mouvements existent, l\u2019historique est conservé.');
      } else {
        toast.success('Article supprimé.');
      }
      navigate('/articles');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (loading) return <PageLoader />;
  if (!article)
    return (
      <EmptyState
        icon={<Package size={40} />}
        title="Article introuvable"
        action={<Button onClick={() => navigate('/articles')}>Retour aux articles</Button>}
      />
    );

  const status = stockStatus(article.stock, article.minStock);
  const statusColor = status === 'out' ? 'red' : status === 'low' ? 'amber' : 'green';
  const margin = Number(article.salePrice) - Number(article.purchasePrice);

  return (
    <div>
      <button
        onClick={() => navigate('/articles')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400"
      >
        <ArrowLeft size={16} /> Retour aux articles
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne info */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {article.brand && <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{article.brand}</p>}
                <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">{article.name}</h1>
                <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{article.reference}</p>
              </div>
              {!article.active && <Badge color="gray">Inactif</Badge>}
            </div>

            <div className="mt-5 flex items-end justify-between rounded-xl bg-slate-50 p-4 dark:bg-surface-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Stock actuel</p>
                <p className="font-display text-3xl font-bold text-slate-900 dark:text-white">{article.stock}</p>
              </div>
              <Badge color={statusColor}>{STOCK_STATUS_LABELS[status]}</Badge>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <Row icon={<Barcode size={16} />} label="Code-barres" value={article.barcode || '—'} mono />
              <Row icon={<MapPin size={16} />} label="Zone" value={article.zone ? `${article.zone.code}${article.zone.name ? ` · ${article.zone.name}` : ''}` : '—'} />
              <Row icon={<Tag size={16} />} label="Catégorie" value={article.category?.name || '—'} />
              <Row icon={<SlidersHorizontal size={16} />} label="Seuil d'alerte" value={`${article.minStock} unité(s)`} />
            </dl>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <Price label="Achat" value={formatEur(article.purchasePrice)} />
              <Price label="Vente" value={formatEur(article.salePrice)} />
              <Price label="Marge" value={formatEur(margin)} accent={margin >= 0} />
            </div>

            {(canEdit || canDelete) && (
              <div className="mt-5 flex flex-col gap-2">
                {canEdit && (
                  <>
                    <Button onClick={openAdjust} fullWidth>
                      <SlidersHorizontal size={18} /> Ajuster le stock
                    </Button>
                    <Button variant="outline" fullWidth onClick={() => navigate('/articles', { state: { edit: article.id } })}>
                      <Pencil size={16} /> Modifier la fiche
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button variant="danger" fullWidth onClick={remove}>
                    <Trash2 size={16} /> Supprimer l'article
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Colonne historique */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Historique des mouvements</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">20 derniers mouvements</p>
            </div>

            {!article.movements || article.movements.length === 0 ? (
              <EmptyState icon={<Package size={36} />} title="Aucun mouvement" description="Les entrées et sorties apparaîtront ici." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {article.movements.map((m) => {
                  const entry = isEntry(m.type);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          entry
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {entry ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{MOVEMENT_LABELS[m.type]}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(m.createdAt)}
                          {m.user?.name ? ` · ${m.user.name}` : ''}
                          {m.reason ? ` · ${m.reason}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            m.quantity >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {m.quantity >= 0 ? '+' : ''}
                          {m.quantity}
                        </p>
                        <p className="text-xs text-slate-400">→ {m.stockAfter}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Modal ajustement */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Ajuster le stock"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveAdjust} loading={saving}>
              Valider l'ajustement
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-surface-800">
            <span className="text-slate-500 dark:text-slate-400">Stock actuel</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{article.stock}</span>
          </div>
          <Field label="Nouveau stock réel" required>
            <Input type="number" min={0} value={newStock} onChange={(e) => setNewStock(Number(e.target.value))} autoFocus />
          </Field>
          <Field label="Motif de l'ajustement">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. correction après inventaire, casse non saisie…" />
          </Field>
          {Number(newStock) !== article.stock && (
            <p className="text-center text-sm">
              Mouvement de régularisation :{' '}
              <span className={`font-bold ${Number(newStock) > article.stock ? 'text-emerald-600' : 'text-amber-600'}`}>
                {Number(newStock) > article.stock ? '+' : ''}
                {Number(newStock) - article.stock}
              </span>
            </p>
          )}
        </div>
      </Modal>

      {dialog}
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className={`text-right font-medium text-slate-800 dark:text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function Price({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${accent === false ? 'text-red-600' : accent ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}
