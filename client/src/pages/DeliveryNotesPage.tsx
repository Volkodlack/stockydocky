import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  ScanLine,
  Trash2,
  Check,
  Eye,
  Download,
  X,
  PackageOpen,
} from 'lucide-react';
import { api, apiError, openPdf } from '../api/client';
import type { DeliveryNote, DeliveryStatus, Client, SearchResultArticle } from '../api/types';
import { formatEur, formatDate, DELIVERY_STATUS_LABELS } from '../lib/format';
import { useToast } from '../hooks/useToast';
import { useBarcodeWedge } from '../hooks/useBarcodeWedge';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Textarea,
  Select,
  Field,
  Modal,
  Badge,
  PageLoader,
  EmptyState,
  useConfirm,
} from '../components/ui';
import { ScannerModal } from '../components/scanner/ScannerModal';
import { SignaturePad } from '../components/delivery/SignaturePad';

const STATUS_COLORS: Record<DeliveryStatus, 'gray' | 'green' | 'red'> = {
  DRAFT: 'gray',
  VALIDATED: 'green',
  CANCELLED: 'red',
};

interface Line {
  articleId: string;
  reference: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export function DeliveryNotesPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/delivery-notes', { params: { status: statusFilter } })
      .then((res) => setNotes(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (note: DeliveryNote) => {
    const ok = await confirm({
      title: 'Supprimer le bon',
      message: `Supprimer le brouillon ${note.number} ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/delivery-notes/${note.id}`);
      toast.success('Bon de livraison supprimé.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Bons de livraison"
        subtitle="Créer, valider et imprimer les bons de livraison"
        icon={<FileText size={22} />}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> Nouveau bon
          </Button>
        }
      />

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="max-w-xs"
          >
            <option value="all">Tous les statuts</option>
            <option value="DRAFT">Brouillons</option>
            <option value="VALIDATED">Validés</option>
            <option value="CANCELLED">Annulés</option>
          </Select>
        </div>

        {loading ? (
          <PageLoader />
        ) : notes.length === 0 ? (
          <EmptyState
            icon={<FileText size={36} />}
            title="Aucun bon de livraison"
            description="Créez votre premier bon de livraison pour démarrer."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={18} /> Nouveau bon
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Numéro</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 text-center font-medium">Lignes</th>
                  <th className="px-4 py-3 text-center font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-surface-800/40"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-100">{n.number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(n.date)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{n.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{n._count?.items ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={STATUS_COLORS[n.status]}>{DELIVERY_STATUS_LABELS[n.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailId(n.id)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                          title="Voir le détail"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openPdf(`/delivery-notes/${n.id}/pdf`)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-surface-800"
                          title="Télécharger le PDF"
                        >
                          <Download size={16} />
                        </button>
                        {n.status !== 'VALIDATED' && (
                          <button
                            onClick={() => remove(n)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            title="Supprimer"
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
        )}
      </Card>

      {createOpen && (
        <CreateNoteModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {detailId && (
        <DetailNoteModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}

      {dialog}
    </div>
  );
}

// ───────────────────────── Création ─────────────────────────
function CreateNoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResultArticle[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/clients').then((r) => setClients(r.data)).catch(() => {});
  }, []);

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
      if (existing) return prev.map((l) => (l.articleId === a.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        { articleId: a.id, reference: a.reference, name: a.name, quantity: 1, unitPrice: Number(a.salePrice) },
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

  const setQty = (id: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.articleId === id ? { ...l, quantity: Math.max(1, qty) } : l)));
  const setPrice = (id: string, price: number) =>
    setLines((prev) => prev.map((l) => (l.articleId === id ? { ...l, unitPrice: Math.max(0, price) } : l)));
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.articleId !== id));

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const submit = async () => {
    if (lines.length === 0) {
      toast.error('Ajoutez au moins un article.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/delivery-notes', {
        clientId: clientId || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({ articleId: l.articleId, quantity: l.quantity, unitPrice: l.unitPrice })),
      });
      toast.success('Bon de livraison créé (brouillon).');
      onCreated();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau bon de livraison"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={lines.length === 0}>
            <Check size={18} /> Créer le bon
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Aucun client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Adresse de livraison (optionnel)">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse spécifique…" />
          </Field>
        </div>

        {/* Recherche / scan d'articles */}
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
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-soft dark:border-slate-800 dark:bg-surface-900">
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
                      {a.reference} · Stock : {a.stock} · {formatEur(a.salePrice)}
                    </p>
                  </div>
                  <Plus size={16} className="shrink-0 text-brand-500" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lignes */}
        {lines.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={36} />}
            title="Aucun article"
            description="Recherchez ou scannez des articles à livrer."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-surface-800/50">
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 text-center font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">P.U. HT</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.articleId} className="border-t border-slate-100 dark:border-slate-800/60">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{l.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{l.reference}</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => setQty(l.articleId, Number(e.target.value))}
                        className="field h-9 w-16 text-center"
                        aria-label="Quantité"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => setPrice(l.articleId, Number(e.target.value))}
                        className="field h-9 w-24 text-right"
                        aria-label="Prix unitaire"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200">
                      {formatEur(l.quantity * l.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeLine(l.articleId)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        aria-label="Retirer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-surface-800/50">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-sm font-medium text-slate-600 dark:text-slate-300">
                    Total HT
                  </td>
                  <td className="px-3 py-2.5 text-right font-display text-base font-bold text-slate-900 dark:text-white">
                    {formatEur(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <Field label="Notes (optionnel)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mentions, conditions…" />
        </Field>

        <p className="text-xs text-slate-400">
          Le bon est créé en brouillon. Le stock ne sera décrémenté qu'à la validation.
        </p>
      </div>

      <ScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanOpen(false);
          void addByBarcode(code);
        }}
      />
    </Modal>
  );
}

// ───────────────────────── Détail ─────────────────────────
function DetailNoteModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/delivery-notes/${id}`)
      .then((res) => setNote(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const validate = async () => {
    const ok = await confirm({
      title: 'Valider le bon',
      message: 'La validation décrémente le stock des articles livrés. Continuer ?',
      confirmLabel: 'Valider',
    });
    if (!ok) return;
    setWorking(true);
    try {
      await api.post(`/delivery-notes/${id}/validate`, signature ? { signature } : {});
      toast.success('Bon validé, stock mis à jour.');
      onChanged();
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setWorking(false);
    }
  };

  const saveSignature = async () => {
    if (!signature) return;
    setWorking(true);
    try {
      await api.post(`/delivery-notes/${id}/signature`, { signature });
      toast.success('Signature enregistrée.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setWorking(false);
    }
  };

  const total =
    note?.items?.reduce((s, it) => s + it.quantity * Number(it.unitPrice), 0) ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={note ? `Bon ${note.number}` : 'Bon de livraison'}
      footer={
        note && (
          <>
            <Button variant="secondary" onClick={() => openPdf(`/delivery-notes/${id}/pdf`)}>
              <Download size={16} /> PDF
            </Button>
            {note.status === 'DRAFT' && (
              <Button onClick={validate} loading={working}>
                <Check size={16} /> Valider
              </Button>
            )}
          </>
        )
      }
    >
      {loading || !note ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge color={STATUS_COLORS[note.status]}>{DELIVERY_STATUS_LABELS[note.status]}</Badge>
            <span className="text-sm text-slate-500 dark:text-slate-400">{formatDate(note.date)}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-400">Client</p>
              <p className="font-medium text-slate-800 dark:text-slate-100">{note.client?.name ?? '—'}</p>
              {note.address && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note.address}</p>}
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-400">Émis par</p>
              <p className="font-medium text-slate-800 dark:text-slate-100">{note.user?.name ?? '—'}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-surface-800/50">
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 text-center font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">P.U.</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {note.items?.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100 dark:border-slate-800/60">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{it.article?.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{it.article?.reference}</p>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{it.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatEur(it.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200">
                      {formatEur(it.quantity * Number(it.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-surface-800/50">
                  <td colSpan={3} className="px-3 py-2.5 text-right text-sm font-medium text-slate-600 dark:text-slate-300">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right font-display text-base font-bold text-slate-900 dark:text-white">
                    {formatEur(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {note.notes && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-surface-800/50 dark:text-slate-300">
              {note.notes}
            </div>
          )}

          {/* Signature */}
          <div>
            <p className="label">Signature du client</p>
            {note.signature ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700">
                <img src={note.signature} alt="Signature" className="max-h-40" />
              </div>
            ) : (
              <>
                <SignaturePad onChange={setSignature} />
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={saveSignature} disabled={!signature} loading={working}>
                    Enregistrer la signature
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {dialog}
    </Modal>
  );
}
