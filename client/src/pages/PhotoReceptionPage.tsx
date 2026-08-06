import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  ScanLine,
  Check,
  RotateCcw,
  Image as ImageIcon,
  CircleAlert,
  CircleCheck,
  Trash2,
} from 'lucide-react';
import { api, apiError } from '../api/client';
import type { Article, Supplier } from '../api/types';
import { useToast } from '../hooks/useToast';
import { useBarcodeWedge } from '../hooks/useBarcodeWedge';
import { readDeliveryNote } from '../lib/ocr';
import { PageHeader, Card, Button, Input, Select, Field } from '../components/ui';
import { ScannerModal } from '../components/scanner/ScannerModal';

interface Line {
  article: Article;
  quantity: number;
  source: 'photo' | 'scan';
}

type Step = 'capture' | 'processing' | 'review';

export function PhotoReceptionPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('capture');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Préparation…');

  // caméra
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // réception
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [redCount, setRedCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
  }, []);

  // ─────────────────────────── Caméra ───────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    const video = videoRef.current;
    if (!video) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamError('La caméra exige une connexion sécurisée (HTTPS). Vous pouvez importer une photo à la place.');
      return;
    }
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});
    } catch {
      setCamError("Impossible d'ouvrir la caméra. Autorisez-la, ou importez une photo.");
    }
  }, []);

  useEffect(() => {
    if (step === 'capture') void startCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  // Recadre la zone du cadre (80% largeur, bande centrale) → canvas
  const cropFrame = (source: HTMLVideoElement | HTMLImageElement, w: number, h: number): HTMLCanvasElement => {
    const fw = w * 0.9;
    const fh = h * 0.55;
    const fx = (w - fw) / 2;
    const fy = (h - fh) / 2;
    const c = document.createElement('canvas');
    c.width = fw;
    c.height = fh;
    c.getContext('2d')!.drawImage(source, fx, fy, fw, fh, 0, 0, fw, fh);
    return c;
  };

  const runOcr = async (canvas: HTMLCanvasElement) => {
    setStep('processing');
    setProgress(0);
    setProgressLabel('Lecture du bon de livraison…');
    try {
      const { codes, estimatedRows } = await readDeliveryNote(canvas, (p) => setProgress(p));
      setProgressLabel('Recherche des articles…');
      const res = await api.post('/articles/lookup', { codes });
      const matched = res.data as Article[];
      // déduplique par article
      const seen = new Set<string>();
      const recognized: Line[] = [];
      for (const a of matched) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        recognized.push({ article: a, quantity: 1, source: 'photo' });
      }
      const total = Math.max(estimatedRows, recognized.length);
      setLines(recognized);
      setTotalRows(total);
      setRedCount(Math.max(0, total - recognized.length));
      setStep('review');
      if (recognized.length === 0) {
        toast.info("Aucun article reconnu sur la photo. Complétez au scan ci-dessous.");
      } else {
        toast.success(`${recognized.length} article(s) reconnu(s).`);
      }
    } catch (e) {
      toast.error(apiError(e));
      setStep('capture');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error('La caméra n’est pas prête.');
      return;
    }
    stopCamera();
    const canvas = cropFrame(video, video.videoWidth, video.videoHeight);
    void runOcr(canvas);
  };

  const onFile = (file: File) => {
    const img = new Image();
    img.onload = () => {
      const canvas = cropFrame(img, img.naturalWidth, img.naturalHeight);
      void runOcr(canvas);
    };
    img.onerror = () => toast.error('Image illisible.');
    img.src = URL.createObjectURL(file);
  };

  // ─────────────────────────── Scan (remplit les lignes rouges) ───────────────────────────
  const addByCode = async (code: string) => {
    const existing = lines.find((l) => l.article.barcode === code || l.article.reference === code);
    if (existing) {
      setLines((prev) => prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)));
      toast.success(`${existing.article.name} : +1`);
      return;
    }
    try {
      const res = await api.post('/articles/lookup', { codes: [code] });
      const a = (res.data as Article[])[0];
      if (!a) {
        toast.error(`Article inconnu (code ${code}).`);
        return;
      }
      setLines((prev) => [...prev, { article: a, quantity: 1, source: 'scan' }]);
      setRedCount((prev) => Math.max(0, prev - 1));
      toast.success(`Ajouté : ${a.name}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  useBarcodeWedge({ onScan: addByCode, enabled: step === 'review' && !scanOpen });

  const setQty = (idx: number, qty: number) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, qty) } : l)));
  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    setRedCount((prev) => prev + 1); // la ligne redevient « à retrouver »
  };
  const adjustTotal = (t: number) => {
    const total = Math.max(lines.length, t);
    setTotalRows(total);
    setRedCount(total - lines.length);
  };

  const validate = async () => {
    if (lines.length === 0) {
      toast.error('Ajoutez au moins un article.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/delivery-notes', {
        supplierId: supplierId || undefined,
        supplierRef: supplierRef.trim() || undefined,
        items: lines.map((l) => ({ articleId: l.article.id, quantity: l.quantity })),
      });
      await api.post(`/delivery-notes/${created.data.id}/validate`);
      toast.success('Réception enregistrée — stock mis à jour.');
      navigate('/bons-livraison');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────── Rendu ───────────────────────────
  return (
    <div>
      <PageHeader
        title="Réception par photo"
        subtitle="Photographiez le bon de livraison, puis complétez au scan"
        icon={<Camera size={22} />}
      />

      {step === 'capture' && (
        <Card>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-xl bg-slate-900">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" muted autoPlay playsInline />
            {/* Cadre de visée */}
            {!camError && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[5%] top-[22.5%] h-[55%] w-[90%] rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                <p className="absolute inset-x-0 top-3 text-center text-xs font-medium text-white/90">
                  Cadrez le tableau des articles dans le rectangle
                </p>
                <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/80">
                  Rapprochez-vous jusqu'à ce que les chiffres soient bien nets · évitez les reflets
                </p>
              </div>
            )}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/90">
                <CircleAlert size={30} />
                <span className="text-sm">{camError}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={capture} disabled={!!camError}>
              <Camera size={18} /> Prendre la photo
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={18} /> Importer une photo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            La lecture se fait sur votre appareil. Les codes lus sont comparés à votre catalogue : seuls vos articles
            sont retenus.
          </p>
        </Card>
      )}

      {step === 'processing' && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-2 w-64 overflow-hidden rounded-full bg-slate-200 dark:bg-surface-700">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{progressLabel}</p>
            <p className="text-xs text-slate-400">La première lecture peut prendre quelques secondes.</p>
          </div>
        </Card>
      )}

      {step === 'review' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">Articles reçus</h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setScanOpen(true)}>
                    <ScanLine size={16} /> Scanner
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLines([]);
                      setRedCount(0);
                      setTotalRows(0);
                      setStep('capture');
                    }}
                  >
                    <RotateCcw size={16} /> Reprendre
                  </Button>
                </div>
              </div>

              {/* lignes vertes (reconnues / scannées) */}
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div
                    key={`${l.article.id}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-3.5 py-2.5 dark:border-green-500/30 dark:bg-green-500/10"
                  >
                    <CircleCheck size={18} className="shrink-0 text-green-600 dark:text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {l.article.brand ? `${l.article.brand} · ` : ''}
                        {l.article.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {l.article.reference}
                        {l.source === 'scan' ? ' · scanné' : ' · lu sur le BL'}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => setQty(i, Number(e.target.value))}
                      className="w-20 text-center"
                    />
                    <button
                      onClick={() => removeLine(i)}
                      className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      aria-label="Retirer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {/* lignes rouges (non reconnues, à compléter au scan) */}
                {Array.from({ length: redCount }).map((_, i) => (
                  <div
                    key={`red-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 dark:border-red-500/30 dark:bg-red-500/10"
                  >
                    <CircleAlert size={18} className="shrink-0 text-red-500" />
                    <p className="flex-1 text-sm text-red-600 dark:text-red-400">
                      Article non reconnu — scannez le produit pour compléter
                    </p>
                  </div>
                ))}

                {lines.length === 0 && redCount === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Aucune ligne. Ajustez le total du BL ou scannez les produits.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* panneau récap / validation */}
          <div className="space-y-4">
            <Card>
              <h3 className="mb-3 font-display font-semibold text-slate-800 dark:text-slate-100">Réception</h3>
              <div className="space-y-3">
                <Field label="Fournisseur">
                  <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">— À préciser —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="N° du BL fournisseur (optionnel)">
                  <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Ex. 000321806" />
                </Field>
                <Field label="Nombre de lignes sur le BL" hint="Ajustez si besoin — génère les lignes rouges à retrouver">
                  <Input type="number" min={lines.length} value={totalRows} onChange={(e) => adjustTotal(Number(e.target.value))} />
                </Field>
              </div>

              <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-green-600 dark:text-green-400">Reconnus / scannés</span>
                  <span className="font-semibold">{lines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-500">À retrouver</span>
                  <span className="font-semibold">{redCount}</span>
                </div>
              </div>

              <Button onClick={validate} loading={saving} disabled={lines.length === 0} fullWidth className="mt-4">
                <Check size={18} /> Valider la réception
              </Button>
              {redCount > 0 && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Les lignes rouges restantes ne seront pas ajoutées au stock.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      <ScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanOpen(false);
          void addByCode(code);
        }}
        title="Scanner un produit reçu"
      />
    </div>
  );
}
