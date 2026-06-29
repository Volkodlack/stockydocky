import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Filter, Pencil, Trash2, ScanLine, X } from 'lucide-react';
import { api, apiError } from '../api/client';
import type { Article, Zone, Category, Paginated } from '../api/types';
import { formatEur } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Field,
  Modal,
  Pagination,
  PageLoader,
  EmptyState,
  StockBadge,
  useConfirm,
} from '../components/ui';
import { ScannerModal } from '../components/scanner/ScannerModal';

const EMPTY: Partial<Article> = {
  reference: '',
  barcode: '',
  brand: '',
  name: '',
  description: '',
  purchasePrice: 0,
  salePrice: 0,
  minStock: 0,
  zoneId: '',
  categoryId: '',
};

export function ArticlesPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  const canEdit = hasRole('ADMIN', 'EMPLOYEE');
  const canDelete = hasRole('ADMIN', 'EMPLOYEE');

  const [data, setData] = useState<Paginated<Article> | null>(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  // Filtres
  const [q, setQ] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [stock, setStock] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState<Partial<Article>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/articles', {
        params: {
          q: q || undefined,
          zoneId: zoneId || undefined,
          categoryId: categoryId || undefined,
          brand: brand || undefined,
          stock: stock || undefined,
          page,
          pageSize: 20,
        },
      })
      .then((res) => setData(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [q, zoneId, categoryId, brand, stock, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get('/zones').then((r) => setZones(r.data)).catch(() => {});
    api.get('/categories').then((r) => setCategories(r.data)).catch(() => {});
    api.get('/articles/meta/brands').then((r) => setBrands(r.data)).catch(() => {});
  }, []);

  // Réinitialise la page sur changement de filtre
  useEffect(() => setPage(1), [q, zoneId, categoryId, brand, stock]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };
  const openEdit = (a: Article) => {
    setEditing(a);
    setForm({
      reference: a.reference,
      barcode: a.barcode ?? '',
      brand: a.brand ?? '',
      name: a.name,
      description: a.description ?? '',
      purchasePrice: Number(a.purchasePrice),
      salePrice: Number(a.salePrice),
      minStock: a.minStock,
      zoneId: a.zoneId ?? '',
      categoryId: a.categoryId ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        reference: form.reference?.trim(),
        barcode: form.barcode?.trim() || null,
        brand: form.brand?.trim() || null,
        name: form.name?.trim(),
        description: form.description?.trim() || null,
        purchasePrice: Number(form.purchasePrice) || 0,
        salePrice: Number(form.salePrice) || 0,
        minStock: Number(form.minStock) || 0,
        zoneId: form.zoneId || null,
        categoryId: form.categoryId || null,
      };
      if (editing) {
        await api.put(`/articles/${editing.id}`, payload);
        toast.success('Article mis à jour.');
      } else {
        await api.post('/articles', payload);
        toast.success('Article créé.');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Article) => {
    const ok = await confirm({
      title: 'Supprimer cet article',
      message: `Voulez-vous vraiment supprimer « ${a.name} » ? Si des mouvements existent, l'article sera désactivé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/articles/${a.id}`);
      if (res.data?.deactivated) {
        toast.info('Article désactivé : des mouvements existent, l\u2019historique est conservé.');
      } else {
        toast.success('Article supprimé.');
      }
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const resetFilters = () => {
    setQ('');
    setZoneId('');
    setCategoryId('');
    setBrand('');
    setStock('');
  };
  const hasActiveFilters = zoneId || categoryId || brand || stock;

  return (
    <div>
      <PageHeader
        title="Articles"
        subtitle={data ? `${data.total} article(s)` : 'Catalogue produits'}
        icon={<Package size={22} />}
        actions={
          canEdit && (
            <Button onClick={openCreate}>
              <Plus size={18} /> Nouvel article
            </Button>
          )
        }
      />

      {/* Barre de recherche + filtres */}
      <Card className="mb-4" padding={false}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Référence, nom, code-barres, marque…"
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <Filter size={16} /> Filtres
            {hasActiveFilters ? <span className="ml-1 h-2 w-2 rounded-full bg-brand-500" /> : null}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
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
            <Field label="Catégorie">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Toutes</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Marque">
              <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="">Toutes</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="État du stock">
              <Select value={stock} onChange={(e) => setStock(e.target.value)}>
                <option value="">Tous</option>
                <option value="low">Stock bas</option>
                <option value="out">Rupture</option>
              </Select>
            </Field>
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X size={14} /> Réinitialiser les filtres
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Tableau */}
      <Card padding={false}>
        {loading ? (
          <PageLoader />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Package size={40} />}
            title="Aucun article"
            description="Aucun article ne correspond à votre recherche."
            action={canEdit && <Button onClick={openCreate}><Plus size={18} /> Créer un article</Button>}
          />
        ) : (
          <>
            {/* Vue desktop : tableau */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    <th className="px-5 py-3 font-semibold">Article</th>
                    <th className="px-5 py-3 font-semibold">Référence</th>
                    <th className="px-5 py-3 font-semibold">Zone</th>
                    <th className="px-5 py-3 text-right font-semibold">Prix vente</th>
                    <th className="px-5 py-3 text-center font-semibold">Stock</th>
                    <th className="px-5 py-3 text-center font-semibold">État</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-surface-800"
                      onClick={() => navigate(`/articles/${a.id}`)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{a.name}</p>
                        {a.brand && <p className="text-xs text-slate-500 dark:text-slate-400">{a.brand}</p>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{a.reference}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{a.zone?.code ?? '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {formatEur(a.salePrice)}
                      </td>
                      <td className="px-5 py-3 text-center font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {a.stock}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StockBadge stock={a.stock} minStock={a.minStock} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              onClick={() => openEdit(a)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-surface-700"
                              aria-label="Modifier"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => remove(a)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              aria-label="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vue mobile : cartes */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {data.items.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-surface-800"
                  onClick={() => navigate(`/articles/${a.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{a.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {a.reference}
                      {a.zone?.code ? ` · ${a.zone.code}` : ''} · {formatEur(a.salePrice)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{a.stock}</p>
                    <StockBadge stock={a.stock} minStock={a.minStock} />
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(a)}
                          className="rounded-lg p-2 text-slate-400 transition active:bg-slate-100 dark:active:bg-surface-700"
                          aria-label="Modifier"
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => remove(a)}
                          className="rounded-lg p-2 text-slate-400 transition active:bg-red-50 active:text-red-600 dark:active:bg-red-500/10"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 pb-4">
              <Pagination
                page={data.page}
                pages={data.pages}
                total={data.total}
                pageSize={data.pageSize}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </Card>

      {/* Modal création / édition */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier l'article" : 'Nouvel article'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving} disabled={!form.reference || !form.name}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Référence" required>
            <Input value={form.reference ?? ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="RB-RX5228" />
          </Field>
          <Field label="Code-barres">
            <div className="flex gap-2">
              <Input value={form.barcode ?? ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="3001234567890" />
              <Button type="button" variant="outline" onClick={() => setScanOpen(true)} aria-label="Scanner">
                <ScanLine size={18} />
              </Button>
            </div>
          </Field>
          <Field label="Désignation" required className="sm:col-span-2">
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monture optique Ray-Ban" />
          </Field>
          <Field label="Marque">
            <Input value={form.brand ?? ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ray-Ban" list="brand-list" />
            <datalist id="brand-list">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label="Seuil d'alerte (stock min.)">
            <Input type="number" min={0} value={form.minStock ?? 0} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
          </Field>
          <Field label="Prix d'achat (€)">
            <Input type="number" min={0} step="0.01" value={form.purchasePrice ?? 0} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
          </Field>
          <Field label="Prix de vente (€)">
            <Input type="number" min={0} step="0.01" value={form.salePrice ?? 0} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} />
          </Field>
          <Field label="Zone">
            <Select value={form.zoneId ?? ''} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>
              <option value="">— Aucune —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} {z.name ? `· ${z.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Catégorie">
            <Select value={form.categoryId ?? ''} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notes complémentaires…" />
          </Field>
          {!editing && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-surface-800 dark:text-slate-400 sm:col-span-2">
              Le stock initial se gère via une <strong>entrée de stock</strong> après création, afin de tracer chaque mouvement.
            </p>
          )}
        </div>
      </Modal>

      <ScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setForm((f) => ({ ...f, barcode: code }));
          setScanOpen(false);
          toast.success('Code-barres renseigné.');
        }}
      />
      {dialog}
    </div>
  );
}
