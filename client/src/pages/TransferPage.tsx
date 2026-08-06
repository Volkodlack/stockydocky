import { useEffect, useRef, useState } from 'react';
import { Shuffle, Search, ScanLine, ArrowRight, PackageSearch, MapPin } from 'lucide-react';
import { api, apiError } from '../api/client';
import type { Article, Zone, SearchResultArticle } from '../api/types';
import { useToast } from '../hooks/useToast';
import { useBarcodeWedge } from '../hooks/useBarcodeWedge';
import { PageHeader, Card, Button, Input, Select, Field, EmptyState, Badge } from '../components/ui';
import { ScannerModal } from '../components/scanner/ScannerModal';

interface DoneTransfer {
  key: string;
  name: string;
  reference: string;
  from: string;
  to: string;
}

export function TransferPage() {
  const toast = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [destZoneId, setDestZoneId] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<DoneTransfer[]>([]);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResultArticle[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/zones').then((r) => setZones(r.data)).catch(() => {});
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
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectById = async (id: string) => {
    try {
      const res = await api.get(`/articles/${id}`);
      setArticle(res.data);
      setDestZoneId('');
      setQ('');
      setResults([]);
      setShowResults(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const selectByBarcode = async (code: string) => {
    try {
      const res = await api.get(`/articles/barcode/${encodeURIComponent(code)}`);
      setArticle(res.data);
      setDestZoneId('');
      toast.success(`Article : ${res.data.name}`);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast.error(status === 404 ? `Article inconnu (code ${code}).` : apiError(e));
    }
  };

  useBarcodeWedge({ onScan: selectByBarcode, enabled: !scanOpen });

  const transfer = async () => {
    if (!article || !destZoneId) return;
    setSaving(true);
    try {
      const res = await api.post('/transfers', { articleId: article.id, zoneId: destZoneId });
      const from = article.zone?.code ?? '—';
      const to = res.data.zone?.code ?? '';
      setDone((prev) =>
        [
          { key: `${article.id}-${Date.now()}`, name: article.name, reference: article.reference, from, to },
          ...prev,
        ].slice(0, 20),
      );
      toast.success(`« ${article.name} » déplacé vers ${to}.`);
      setArticle(null);
      setDestZoneId('');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const destZones = zones.filter((z) => z.id !== article?.zone?.id);

  return (
    <div>
      <PageHeader
        title="Transfert de zone"
        subtitle="Déplacer un article d'une zone à une autre"
        icon={<Shuffle size={22} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            {/* Sélection de l'article */}
            <div ref={boxRef} className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => results.length && setShowResults(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const code = q.trim();
                        if (!code) return;
                        const exact = results.find((a) => a.barcode === code || a.reference === code);
                        if (exact) void selectById(exact.id);
                        else void selectByBarcode(code);
                      }
                    }}
                    inputMode="search"
                    enterKeyHint="done"
                    placeholder="Rechercher un article (réf, nom, code-barres)…"
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
                      onClick={() => selectById(a.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {a.brand ? `${a.brand} · ` : ''}
                          {a.name}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {a.reference}
                          {a.zone?.code ? ` · zone ${a.zone.code}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Article sélectionné + destination */}
            {!article ? (
              <div className="mt-2">
                <EmptyState
                  icon={<PackageSearch size={36} />}
                  title="Aucun article sélectionné"
                  description="Recherchez ou scannez l'article à déplacer."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {article.brand ? `${article.brand} · ` : ''}
                    {article.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{article.reference}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <MapPin size={15} className="text-slate-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Zone actuelle :</span>
                    <Badge color="gray">{article.zone?.code ?? 'Aucune'}</Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field label="Nouvelle zone" className="flex-1">
                    <Select value={destZoneId} onChange={(e) => setDestZoneId(e.target.value)}>
                      <option value="">— Choisir la destination —</option>
                      {destZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.code}
                          {z.name ? ` — ${z.name}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button onClick={transfer} loading={saving} disabled={!destZoneId}>
                    <ArrowRight size={18} /> Transférer
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Historique de session */}
        <div>
          <Card>
            <h3 className="mb-3 font-display font-semibold text-slate-800 dark:text-slate-100">Transferts récents</h3>
            {done.length === 0 ? (
              <p className="text-sm text-slate-400">Les transferts effectués apparaîtront ici.</p>
            ) : (
              <ul className="space-y-2.5">
                {done.map((d) => (
                  <li key={d.key} className="text-sm">
                    <p className="font-medium text-slate-700 dark:text-slate-200">{d.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {d.reference} · {d.from}
                      <ArrowRight size={12} className="text-brand-500" />
                      <span className="font-medium text-brand-600 dark:text-brand-400">{d.to}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanOpen(false);
          void selectByBarcode(code);
        }}
      />
    </div>
  );
}
