import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ScanLine, Plus, Trash2, Check, X, PackagePlus } from 'lucide-react';
import { api, apiError } from '../../api/client';
import type { SearchResultArticle, Supplier, MovementType } from '../../api/types';
import { formatEur, ENTRY_REASONS, EXIT_REASONS } from '../../lib/format';
import { useToast } from '../../hooks/useToast';
import { useBarcodeWedge } from '../../hooks/useBarcodeWedge';
import { PageHeader, Card, Button, Input, Select, Field, EmptyState } from '../ui';
import { ScannerModal } from '../scanner/ScannerModal';

interface Line {
  articleId: string;
  reference: string;
  name: string;
  brand?: string | null;
  stock: number;
  quantity: number;
  price: number;
}

export function MovementComposer({ mode }: { mode: 'entry' | 'exit' }) {
  const isEntry = mode === 'entry';
  const navigate = useNavigate();
  const toast = useToast();

  const [type, setType] = useState<MovementType>(isEntry ? 'ENTRY_SUPPLIER' : 'EXIT_SALE');
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [globalReason, setGlobalReason] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  // Recherche article
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResultArticle[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEntry) api.get('/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
  }, [isEntry]);

  useEffect(() => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get('/search', { params: { q } })
        .then((res) => {
          setResults(res.data.articles ?? []);
          setShowResults(true);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const addArticle = (a: SearchResultArticle) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.articleId === a.id);
      if (existing) {
        return prev.map((l) => (l.articleId === a.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          articleId: a.id,
          reference: a.reference,
          name: a.name,
          brand: a.brand,
          stock: a.stock,
          quantity: 1,
          price: Number(a.salePrice),
        },
      ];
    });
    setQ('');
    setResults([]);
    setShowResults(false);
  };

  const addByBarcode = async (code: string) => {
    try {
      const res = await api.get(`/articles/barcode/${encodeURIComponent(code)}`);
      const a = res.data;
      addArticle({
        id: a.id,
        reference: a.reference,
        barcode: a.barcode,
        brand: a.brand,
        name: a.name,
        stock: a.stock,
        minStock: a.minStock,
        salePrice: a.salePrice,
        zone: a.zone,
      });
      toast.success(`Ajouté : ${a.name}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  useBarcodeWedge({ onScan: addByBarcode, enabled: !scanOpen });

  const setQty = (articleId: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.articleId === articleId ? { ...l, quantity: Math.max(1, qty) } : l)));
  const removeLine = (articleId: string) => setLines((prev) => prev.filter((l) => l.articleId !== articleId));

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  const submit = async () => {
    if (lines.length === 0) {
      toast.error('Ajoutez au moins un article.');
      return;
    }
    // Vérifie le stock disponible pour les sorties
    if (!isEntry) {
      const insufficient = lines.find((l) => l.quantity > l.stock);
      if (insufficient) {
        toast.error(`Stock insuffisant pour ${insufficient.name} (dispo : ${insufficient.stock}).`);
        return;
      }
    }
    setSaving(true);
    try {
      const items = lines.map((l) => ({ articleId: l.articleId, quantity: l.quantity }));
      if (isEntry) {
        await api.post('/movements/entry', {
          type,
          supplierId: supplierId || undefined,
          reference: reference.trim() || undefined,
          reason: globalReason.trim() || undefined,
          items,
        });
        toast.success(`Entrée enregistrée (${totalUnits} unité(s)).`);
      } else {
        await api.post('/movements/exit', {
          type,
          reason: globalReason.trim() || undefined,
          items,
        });
        toast.success(`Sortie enregistrée (${totalUnits} unité(s)).`);
      }
      navigate('/mouvements');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const reasons = isEntry ? ENTRY_REASONS : EXIT_REASONS;

  return (
    <div>
      <PageHeader
        title={isEntry ? 'Entrée de stock' : 'Sortie de stock'}
        subtitle={isEntry ? 'Réceptionner des articles dans le stock' : 'Retirer des articles du stock'}
        icon={<PackagePlus size={22} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Composition */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            {/* Recherche / scan */}
            <div ref={searchRef} className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => results.length && setShowResults(true)}
                    placeholder="Rechercher un article à ajouter…"
                    className="pl-10"
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
                  <ScanLine size={18} /> <span className="hidden sm:inline">Scanner</span>
                </Button>
              </div>

              {showResults && results.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-soft dark:border-slate-800 dark:bg-surface-900">
                  {results.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => addArticle(a)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {a.brand ? `${a.brand} · ` : ''}
                          {a.name}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {a.reference} · Stock : {a.stock}
                        </p>
                      </div>
                      <Plus size={16} className="shrink-0 text-brand-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lignes */}
            <div className="mt-4">
              {lines.length === 0 ? (
                <EmptyState
                  icon={<PackagePlus size={36} />}
                  title="Aucun article"
                  description="Recherchez ou scannez un article pour composer le mouvement."
                />
              ) : (
                <ul className="space-y-2">
                  {lines.map((l) => {
                    const insufficient = !isEntry && l.quantity > l.stock;
                    return (
                      <li
                        key={l.articleId}
                        className={`flex items-center gap-3 rounded-xl border p-3 ${
                          insufficient
                            ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{l.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {l.reference} · Stock actuel : {l.stock}
                            {insufficient && <span className="ml-1 font-medium text-red-600">· insuffisant</span>}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => setQty(l.articleId, Number(e.target.value))}
                          className="field h-10 w-20 text-center"
                          aria-label="Quantité"
                        />
                        <button
                          onClick={() => removeLine(l.articleId)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          aria-label="Retirer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Paramètres du mouvement */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-slate-900 dark:text-white">Détails du mouvement</h2>
            <div className="space-y-4">
              <Field label="Type">
                <Select value={type} onChange={(e) => setType(e.target.value as MovementType)}>
                  {reasons.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {isEntry && (
                <>
                  <Field label="Fournisseur">
                    <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">— Aucun —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Référence (BL, facture…)">
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BL fournisseur n°…" />
                  </Field>
                </>
              )}

              <Field label="Note / motif">
                <Input value={globalReason} onChange={(e) => setGlobalReason(e.target.value)} placeholder="Commentaire optionnel" />
              </Field>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total unités</span>
              <span className="font-display text-xl font-bold text-slate-900 dark:text-white">{totalUnits}</span>
            </div>
            {isEntry && lines.length > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm text-slate-400">
                <span>Valeur (prix vente)</span>
                <span>{formatEur(lines.reduce((s, l) => s + l.quantity * l.price, 0))}</span>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={submit} loading={saving} disabled={lines.length === 0} fullWidth size="lg">
                <Check size={18} /> {isEntry ? "Valider l'entrée" : 'Valider la sortie'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/mouvements')} fullWidth>
                <X size={16} /> Annuler
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanOpen(false);
          void addByBarcode(code);
        }}
      />
    </div>
  );
}
