import { useEffect, useRef } from 'react';

/**
 * Détecte une douchette code-barres USB / Bluetooth (mode « keyboard wedge »).
 *
 * Une douchette se comporte comme un clavier qui tape très vite puis envoie
 * « Entrée ». On distingue donc un scan d'une frappe humaine par la vitesse :
 * si plusieurs caractères arrivent à moins de `maxDelay` ms d'intervalle et que
 * la séquence se termine par « Enter », on considère que c'est un scan.
 *
 * Le hook ignore les frappes lorsqu'un champ de saisie est focalisé (sauf si
 * `ignoreInputs` vaut false), pour ne pas interférer avec la saisie manuelle.
 */
interface Options {
  onScan: (code: string) => void;
  minLength?: number;
  maxDelay?: number;
  enabled?: boolean;
  /** Si true (défaut), on n'écoute pas quand un input/textarea/select est actif. */
  ignoreInputs?: boolean;
}

export function useBarcodeWedge({
  onScan,
  minLength = 3,
  maxDelay = 35,
  enabled = true,
  ignoreInputs = true,
}: Options): void {
  const buffer = useRef('');
  const lastTime = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const isFormField = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      // Touches de contrôle à ignorer
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const delta = now - lastTime.current;
      lastTime.current = now;

      // Trop de temps écoulé → on repart d'un buffer vide (frappe humaine)
      if (delta > maxDelay && e.key !== 'Enter') {
        buffer.current = '';
      }

      if (e.key === 'Enter') {
        const code = buffer.current;
        buffer.current = '';
        if (code.length >= minLength) {
          // Si la cible est un champ ET qu'on ignore les champs, on ne fait rien
          if (ignoreInputs && isFormField(e.target)) return;
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      // On n'accumule que les caractères imprimables d'un seul signe
      if (e.key.length === 1) {
        if (ignoreInputs && isFormField(e.target)) {
          buffer.current = '';
          return;
        }
        buffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, minLength, maxDelay, ignoreInputs]);
}
