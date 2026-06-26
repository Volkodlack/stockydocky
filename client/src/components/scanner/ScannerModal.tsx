import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Feedback';

/**
 * Scanner code-barres via la caméra du smartphone.
 * S'appuie sur @zxing/browser (décodage multi-formats : EAN, Code128, QR…).
 * Sélectionne par défaut la caméra arrière quand elle est disponible.
 */
export function ScannerModal({
  open,
  onClose,
  onDetected,
  title = 'Scanner un code-barres',
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  // Énumère les caméras disponibles à l'ouverture
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((list) => {
        if (cancelled) return;
        setDevices(list);
        // Préfère une caméra « arrière / back / environment »
        const back = list.find((d) => /back|arrière|rear|environment/i.test(d.label));
        setDeviceId(back?.deviceId ?? list[0]?.deviceId);
        if (list.length === 0) setError("Aucune caméra détectée sur cet appareil.");
      })
      .catch(() => {
        if (!cancelled) setError("Impossible d'accéder aux caméras. Autorisez l'accès dans le navigateur.");
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Démarre / redémarre le flux quand la caméra sélectionnée change
  useEffect(() => {
    if (!open || !deviceId || !videoRef.current) return;
    let cancelled = false;
    setStarting(true);
    setError(null);

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(deviceId, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (cancelled) return;
        setStarting(false);
        if (result) {
          const text = result.getText();
          controls.stop();
          onDetected(text);
        }
        // err est émis en continu tant qu'aucun code n'est trouvé → on l'ignore
        void err;
      })
      .catch(() => {
        if (!cancelled) {
          setError("Impossible de démarrer la caméra. Vérifiez les autorisations.");
          setStarting(false);
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, deviceId, onDetected]);

  // Nettoyage à la fermeture
  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
    }
  }, [open]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    controlsRef.current?.stop();
    setDeviceId(next.deviceId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          {devices.length > 1 && (
            <Button variant="secondary" onClick={switchCamera}>
              <RefreshCw size={16} /> Changer de caméra
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {/* Réticule de visée */}
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-3/4 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
              <Spinner size={28} className="text-white" />
              <span className="text-sm">Démarrage de la caméra…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/90">
              <CameraOff size={32} />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
          <Camera size={14} /> Placez le code-barres dans le cadre. La détection est automatique.
        </p>
      </div>
    </Modal>
  );
}
