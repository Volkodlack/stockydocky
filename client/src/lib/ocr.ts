import { createWorker, PSM } from 'tesseract.js';

/**
 * Lecture OCR d'un bon de livraison papier (sans IA).
 *
 * Le prétraitement (agrandissement + niveaux de gris + binarisation) et les
 * multiples passes de segmentation reproduisent ce qui a permis, en test, de
 * lire les 3 codes d'un vrai BL CEDEO. Les codes sont ensuite croisés côté
 * serveur avec le catalogue : seuls ceux qui existent sont retenus.
 */

export interface OcrOutcome {
  text: string;
  codes: string[]; // suites de chiffres candidates (à croiser avec la base)
  estimatedRows: number; // estimation du nombre de lignes d'articles du BL
}

/** Agrandit (ou réduit), passe en gris et binarise une image sur un canvas. */
function preprocess(source: HTMLCanvasElement): HTMLCanvasElement {
  const MAX_W = 2200; // plafond pour éviter les plantages mémoire sur mobile
  let scale = 1;
  if (source.width < 1400) scale = 2; // agrandit si l'image est petite
  else if (source.width > MAX_W) scale = MAX_W / source.width; // réduit si trop grande
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(source.width * scale));
  c.height = Math.max(1, Math.round(source.height * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);

  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = gray > 140 ? 255 : 0; // seuil de binarisation (comme le test Python)
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function estimateRows(text: string): number {
  // chaque ligne d'article porte une quantité type « 1 UN », « 2 PCE »…
  const matches = text.match(/\b\d+\s?(?:UN|PCE|PCS|PC|U|ML|M|KG|L|BTE|SAC|CT)\b/gi);
  return matches ? matches.length : 0;
}

/**
 * Lit un canvas (image cadrée du BL) et renvoie les codes candidats.
 * onProgress : 0 → 1 pour l'affichage d'une barre.
 */
export async function readDeliveryNote(
  source: HTMLCanvasElement,
  onProgress?: (p: number) => void,
): Promise<OcrOutcome> {
  const canvas = preprocess(source);
  const worker = await createWorker('eng', undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (onProgress && m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(m.progress);
      }
    },
  });

  const codes = new Set<string>();
  let fullText = '';
  try {
    const modes = [PSM.SINGLE_BLOCK, PSM.AUTO, PSM.SPARSE_TEXT];
    for (const psm of modes) {
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist: '0123456789|ABCDEFGHIJKLMNOPQRSTUVWXYZ .-+/',
      });
      const { data } = await worker.recognize(canvas);
      fullText += '\n' + data.text;
      for (const m of data.text.matchAll(/\d{4,14}/g)) codes.add(m[0]);
    }
  } finally {
    await worker.terminate();
  }

  return { text: fullText, codes: [...codes], estimatedRows: estimateRows(fullText) };
}
