import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, CameraOff, RefreshCw, RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Feedback';

/**
 * Scanner code-barres via la caméra du smartphone.
 *
 * Fonctionne sur iOS (Safari) et Android (Chrome) en demandant DIRECTEMENT la
 * caméra arrière via `facingMode: 'environment'` (et non en listant les caméras
 * par libellé — ces libellés sont vides tant que la permission n'est pas
 * accordée sur iOS, ce qui sélectionnait par erreur la caméra frontale).
 *
 * Prérequis : contexte sécurisé (HTTPS) — automatique sur Render.
 */

// On restreint aux formats courants en magasin (codes-barres produits + QR) :
// décodage plus rapide et plus fiable sur mobile.
const hints = new Map<DecodeHintType, unknown>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
]);

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
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  // Arrêt complet : contrôles zxing + pistes vidéo (évite la caméra qui reste
  // allumée sur iOS) + détachement du flux.
  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const v = videoRef.current;
    if (v && v.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }, []);

  // Callback de décodage (appelé en continu ; on n'agit qu'en cas de résultat).
  const handleResult = useCallback(
    (result: { getText: () => string } | undefined, _err: unknown, controls: IScannerControls) => {
      controlsRef.current = controls;
      if (result) {
        const text = result.getText();
        stop();
        onDetectedRef.current(text);
      }
    },
    [stop],
  );

  // Démarre la caméra. Sans `deviceId` → caméra arrière via facingMode.
  const start = useCallback(
    async (deviceId?: string) => {
      const video = videoRef.current;
      if (!video) return;
      setStarting(true);
      setError(null);

      // getUserMedia n'existe qu'en contexte sécurisé (HTTPS) ou sur localhost.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('La caméra nécessite une connexion sécurisée (HTTPS).');
        setStarting(false);
        return;
      }

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 600,
      });

      try {
        if (deviceId) {
          controlsRef.current = await reader.decodeFromVideoDevice(deviceId, video, handleResult);
        } else {
          // Caméra ARRIÈRE en priorité (ideal → repli automatique sur desktop).
          controlsRef.current = await reader.decodeFromConstraints(
            {
              audio: false,
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            video,
            handleResult,
          );
        }
        setStarting(false);

        // La permission étant accordée, les libellés sont désormais lisibles :
        // on liste les caméras pour proposer un bouton « changer » si plusieurs.
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          const cams = all.filter((d) => d.kind === 'videoinput');
          setDevices(cams);
          const current =
            (video.srcObject as MediaStream | null)?.getVideoTracks()[0]?.getSettings().deviceId ??
            deviceId ??
            null;
          setActiveDeviceId(current);
        } catch {
          /* énumération non critique */
        }
      } catch (e) {
        const name = (e as { name?: string })?.name ?? '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError(
            "Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez.",
          );
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('Aucune caméra arrière détectée. Essayez de changer de caméra.');
        } else if (name === 'NotReadableError') {
          setError('La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.');
        } else {
          setError('Impossible de démarrer la caméra. Vérifiez les autorisations puis réessayez.');
        }
        setStarting(false);
      }
    },
    [handleResult],
  );

  // Démarrage à l'ouverture, arrêt à la fermeture.
  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    // léger délai : laisse le <video> se monter dans la modale (portail)
    const id = setTimeout(() => void start(), 60);
    return () => {
      clearTimeout(id);
      stop();
    };
  }, [open, start, stop]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === activeDeviceId);
    const next = devices[(idx + 1) % devices.length];
    stop();
    setActiveDeviceId(next.deviceId);
    void start(next.deviceId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          {error ? (
            <Button variant="secondary" onClick={() => void start()}>
              <RotateCcw size={16} /> Réessayer
            </Button>
          ) : (
            devices.length > 1 && (
              <Button variant="secondary" onClick={switchCamera}>
                <RefreshCw size={16} /> Changer de caméra
              </Button>
            )
          )}
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-slate-900 sm:aspect-[4/3]">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-full w-full object-cover" muted autoPlay playsInline />

          {/* Réticule de visée */}
          {!error && !starting && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-28 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.30)]" />
            </div>
          )}

          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/90">
              <Spinner size={28} className="text-white" />
              <span className="text-sm">Démarrage de la caméra…</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white/90">
              <CameraOff size={32} />
              <span className="text-sm leading-relaxed">{error}</span>
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
