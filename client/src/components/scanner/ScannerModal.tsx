import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, CameraOff, RefreshCw, RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Feedback';

/**
 * Scanner code-barres caméra — iOS (Safari) et Android (Chrome).
 *
 * Points clés de fiabilité mobile :
 *  - On acquiert le flux nous-mêmes via getUserMedia en demandant la caméra
 *    ARRIÈRE (`facingMode: { exact: 'environment' }`), avec repli souple si
 *    l'appareil n'a pas de caméra arrière (ex. ordinateur).
 *  - Attributs iOS posés explicitement (playsinline + muted) et `play()` forcé.
 *  - Contexte sécurisé (HTTPS) vérifié : la caméra est bloquée sinon.
 *  - L'erreur technique réelle est affichée à l'écran pour faciliter le support.
 */

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

interface ErrInfo {
  friendly: string;
  detail: string;
}

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
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<ErrInfo | null>(null);
  const [starting, setStarting] = useState(true);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v && v.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }, []);

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

  const describe = (e: unknown): ErrInfo => {
    const err = e as { name?: string; message?: string };
    const name = err?.name ?? '';
    const message = err?.message ?? String(e);
    let friendly: string;
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        friendly =
          "Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez.";
        break;
      case 'NotFoundError':
      case 'OverconstrainedError':
        friendly = "Aucune caméra utilisable n'a été trouvée sur l'appareil.";
        break;
      case 'NotReadableError':
      case 'AbortError':
        friendly = 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.';
        break;
      default:
        friendly = 'Impossible de démarrer la caméra. Vérifiez les autorisations puis réessayez.';
    }
    return { friendly, detail: name ? `${name} — ${message}` : message };
  };

  const start = useCallback(
    async (deviceId?: string) => {
      const video = videoRef.current;
      if (!video) return;
      setStarting(true);
      setError(null);

      // Contexte sécurisé obligatoire (HTTPS), sauf localhost.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError({
          friendly:
            "La caméra exige une connexion sécurisée (HTTPS). Ouvrez le site via son adresse https:// (l'URL Render), pas via une adresse IP en http://.",
          detail: `isSecureContext=${window.isSecureContext}, mediaDevices=${!!navigator.mediaDevices}`,
        });
        setStarting(false);
        return;
      }

      // Attributs nécessaires à la lecture inline sur iOS.
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.muted = true;

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 600,
      });

      try {
        let stream: MediaStream;
        if (deviceId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: false,
          });
        } else {
          // 1) On force la caméra arrière…
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { exact: 'environment' } },
              audio: false,
            });
          } catch (err) {
            // 2) …et si l'appareil n'en a pas (ordinateur), repli souple.
            const n = (err as { name?: string })?.name;
            if (n === 'OverconstrainedError' || n === 'NotFoundError') {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
              });
            } else {
              throw err;
            }
          }
        }

        streamRef.current = stream;
        controlsRef.current = await reader.decodeFromStream(stream, video, handleResult);
        // play() explicite (certaines versions d'iOS ne démarrent pas seules)
        try {
          await video.play();
        } catch {
          /* déjà en lecture ou bloqué silencieusement */
        }
        setStarting(false);

        // Permission accordée → libellés disponibles : on prépare le switch.
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          const cams = all.filter((d) => d.kind === 'videoinput');
          setDevices(cams);
          const current =
            stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? null;
          setActiveDeviceId(current);
        } catch {
          /* non critique */
        }
      } catch (e) {
        stop();
        setError(describe(e));
        setStarting(false);
      }
    },
    [handleResult, stop],
  );

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
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
            <Button variant="primary" onClick={() => void start()}>
              <RotateCcw size={16} /> Activer la caméra
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
              <span className="text-sm leading-relaxed">{error.friendly}</span>
              <span className="max-w-full break-words font-mono text-[10px] text-white/50">{error.detail}</span>
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
