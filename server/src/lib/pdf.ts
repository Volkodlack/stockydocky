import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { COMPANY_LOGO_PNG_BASE64 } from './logo';

/**
 * Génération du PDF d'un bon de livraison.
 *
 * Améliorations par rapport à la version initiale :
 *  - Pagination automatique : les lignes débordant sur une 2ᵉ page (ou plus)
 *    déclenchent un saut de page avec ré-affichage de l'en-tête de colonnes ;
 *    totaux, notes et signature ne se chevauchent plus jamais.
 *  - Montants fiables : les espaces insécables fines (U+202F) / insécables
 *    (U+00A0) produites par Intl sont normalisées en espace simple, compatibles
 *    avec l'encodage WinAnsi de la police Helvetica intégrée (plus de caractère
 *    manquant sur les montants à 4 chiffres et +).
 *  - TVA et Total TTC (taux configurable).
 *  - En-tête émetteur entièrement paramétrable (raison sociale, adresse, SIRET,
 *    TVA intracommunautaire, téléphone, e-mail) + mentions légales en pied.
 *  - Pied de page (mentions légales + numéro de page) sur chaque page.
 *
 * Configuration via variables d'environnement (toutes optionnelles) :
 *   PDF_VAT_RATE     Taux de TVA en % (défaut "20"). Mettre "0" pour masquer la TVA.
 *   COMPANY_NAME     Raison sociale (défaut "SAS Carles")
 *   COMPANY_TAGLINE  Sous-titre (défaut "Gestion de stock")
 *   COMPANY_ADDRESS  Adresse postale
 *   COMPANY_PHONE    Téléphone
 *   COMPANY_EMAIL    E-mail
 *   COMPANY_SIRET    Numéro SIRET
 *   COMPANY_VAT      N° de TVA intracommunautaire
 */

interface DeliveryItem {
  quantity: number;
  unitPrice: number;
  article: { reference: string; name: string; brand: string | null };
}

interface DeliveryData {
  number: string;
  date: Date;
  status: string;
  address: string | null;
  notes: string | null;
  signature: string | null;
  client: { name: string; email: string | null; phone: string | null; address: string | null } | null;
  user: { name: string } | null;
  items: DeliveryItem[];
}

// Espaces insécables produites par Intl, absentes de l'encodage WinAnsi.
const NBSP = /[\u202f\u00a0]/g;

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(NBSP, ' ');

const formatRate = (r: number) =>
  r.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(NBSP, ' ');

const STATUS_LABEL: Record<string, string> = {
  VALIDATED: 'Validé',
  DRAFT: 'Brouillon',
  CANCELLED: 'Annulé',
};

/** Lit une variable d'environnement texte, en repliant sur une valeur par défaut. */
const envText = (key: string, fallback = '') => {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : fallback;
};

/** Génère le PDF d'un bon de livraison et le diffuse dans la réponse HTTP. */
export function streamDeliveryNotePdf(res: Response, data: DeliveryData) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${data.number}.pdf"`);
  doc.pipe(res);

  // Palette
  const navy = '#1e293b';
  const brand = '#523996'; // violet SAS Carles
  const muted = '#64748b';
  const zebra = '#f1f5f9';

  // Géométrie de page
  const PAGE_W = doc.page.width; // ~595.28 (A4)
  const PAGE_H = doc.page.height; // ~841.89
  const M = 50;
  const CONTENT_W = PAGE_W - M * 2; // ~495
  const RIGHT = M + CONTENT_W; // 545
  const MAX_Y = PAGE_H - 78; // limite basse du contenu (le pied vit en dessous)

  // On gère la pagination nous-mêmes : neutralise la pagination auto de PDFKit.
  const disableAutoPaging = () => {
    doc.page.margins.bottom = 0;
  };
  disableAutoPaging();

  // Émetteur (paramétrable)
  const company = {
    name: envText('COMPANY_NAME', 'SAS Carles'),
    tagline: envText('COMPANY_TAGLINE', 'Gestion de stock'),
    address: envText('COMPANY_ADDRESS'),
    phone: envText('COMPANY_PHONE'),
    email: envText('COMPANY_EMAIL'),
    siret: envText('COMPANY_SIRET'),
    vat: envText('COMPANY_VAT'),
  };

  // Taux de TVA
  const parsedRate = Number.parseFloat(envText('PDF_VAT_RATE', '20').replace(',', '.'));
  const vatRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 20;

  // Colonnes du tableau
  const C = {
    ref: { x: M + 5, w: 80 },
    name: { x: 140, w: 200 },
    qty: { x: 345, w: 35 }, // aligné à droite
    pu: { x: 385, w: 75 }, // aligné à droite
    total: { x: 465, w: 80 }, // aligné à droite
  };

  // ───────────── Helpers de mise en page ─────────────

  const drawColumnHeader = (top: number): number => {
    doc.fillColor(brand).rect(M, top, CONTENT_W, 22).fill();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
    doc.text('Référence', C.ref.x, top + 7, { lineBreak: false });
    doc.text('Désignation', C.name.x, top + 7, { lineBreak: false });
    doc.text('Qté', C.qty.x, top + 7, { width: C.qty.w, align: 'right', lineBreak: false });
    doc.text('P.U. HT', C.pu.x, top + 7, { width: C.pu.w, align: 'right', lineBreak: false });
    doc.text('Total', C.total.x, top + 7, { width: C.total.w, align: 'right', lineBreak: false });
    return top + 22;
  };

  // Nouvelle page « suite » avec en-tête de colonnes (pour la suite du tableau).
  const newTablePage = (): number => {
    doc.addPage();
    disableAutoPaging();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(11);
    doc.text(`Bon de livraison N° ${data.number} (suite)`, M, M, { lineBreak: false });
    return drawColumnHeader(M + 24);
  };

  // Nouvelle page « suite » simple (pour totaux / signature qui débordent).
  const newPlainPage = (): number => {
    doc.addPage();
    disableAutoPaging();
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(11);
    doc.text(`Bon de livraison N° ${data.number} (suite)`, M, M, { lineBreak: false });
    return M + 30;
  };

  // ───────────── En-tête (page 1) ─────────────
  doc.fillColor(brand).fontSize(22).font('Helvetica-Bold').text('BON DE LIVRAISON', M, 50);
  doc.fillColor(navy).fontSize(11).font('Helvetica').text(`N° ${data.number}`, M, 80);
  doc
    .fillColor(muted)
    .fontSize(10)
    .text(`Date : ${new Date(data.date).toLocaleDateString('fr-FR')}`, M, 96)
    .text(`Statut : ${STATUS_LABEL[data.status] ?? data.status}`, M, 110);

  // Bloc émetteur (à droite) : logo SAS Carles + coordonnées
  const emitterX = 300;
  const emitterW = RIGHT - emitterX; // ~245
  const LOGO_W = 150;
  const LOGO_RATIO = 595.28 / 241.04; // proportions du logo source
  let ey = 48;
  let logoDrawn = false;
  try {
    const logoBuf = Buffer.from(COMPANY_LOGO_PNG_BASE64, 'base64');
    if (logoBuf.length > 0) {
      doc.image(logoBuf, RIGHT - LOGO_W, ey, { width: LOGO_W });
      ey += LOGO_W / LOGO_RATIO + 8;
      logoDrawn = true;
    }
  } catch {
    /* logo illisible : on retombe sur le nom en texte */
  }
  if (!logoDrawn) {
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(13).text(company.name, emitterX, ey, {
      width: emitterW,
      align: 'right',
    });
    ey += 18;
    if (company.tagline) {
      doc.font('Helvetica').fontSize(8.5).fillColor(muted).text(company.tagline, emitterX, ey, {
        width: emitterW,
        align: 'right',
      });
      ey += 12;
    }
  }
  doc.font('Helvetica').fontSize(8.5).fillColor(muted);
  const emitterLines = [company.address, company.phone, company.email].filter(Boolean);
  for (const line of emitterLines) {
    doc.text(line, emitterX, ey, { width: emitterW, align: 'right' });
    ey += doc.heightOfString(line, { width: emitterW }) + 1;
  }

  // ───────────── Bloc destinataire ─────────────
  let y = 150;
  doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('Destinataire', M, y);
  y += 16;
  doc.font('Helvetica').fontSize(10);
  if (data.client) {
    doc.fillColor('#000').text(data.client.name, M, y);
    y += 14;
    if (data.client.phone) {
      doc.fillColor(muted).text(data.client.phone, M, y);
      y += 13;
    }
    if (data.client.email) {
      doc.fillColor(muted).text(data.client.email, M, y);
      y += 13;
    }
  } else {
    doc.fillColor(muted).text('—', M, y);
    y += 14;
  }
  const addr = data.address || data.client?.address;
  if (addr) {
    doc.fillColor(muted).fontSize(9);
    doc.text(addr, M, y, { width: 250 });
    y += doc.heightOfString(addr, { width: 250 }) + 6;
  }

  // ───────────── Tableau des produits ─────────────
  const PAD = 6;
  const MIN_ROW = 20;
  let rowY = drawColumnHeader(Math.max(y + 10, Math.max(ey, 235)));

  let totalHT = 0;
  data.items.forEach((item, i) => {
    const lineTotal = item.quantity * item.unitPrice;
    totalHT += lineTotal;

    const label = item.article.brand ? `${item.article.brand} ${item.article.name}` : item.article.name;
    doc.font('Helvetica').fontSize(9);
    const labelH = doc.heightOfString(label, { width: C.name.w });
    const rowH = Math.max(MIN_ROW, labelH + PAD * 2 - 4);

    // Saut de page si la ligne ne tient plus
    if (rowY + rowH > MAX_Y) {
      rowY = newTablePage();
    }

    if (i % 2 === 0) {
      doc.fillColor(zebra).rect(M, rowY, CONTENT_W, rowH).fill();
    }

    const ty = rowY + PAD;
    doc.fillColor('#0f172a').font('Helvetica').fontSize(9);
    doc.text(item.article.reference, C.ref.x, ty, { width: C.ref.w });
    doc.text(label, C.name.x, ty, { width: C.name.w });
    doc.text(String(item.quantity), C.qty.x, ty, { width: C.qty.w, align: 'right' });
    doc.text(euro(item.unitPrice), C.pu.x, ty, { width: C.pu.w, align: 'right' });
    doc.text(euro(lineTotal), C.total.x, ty, { width: C.total.w, align: 'right' });

    rowY += rowH;
  });

  // Trait de clôture du tableau
  doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(M, rowY).lineTo(RIGHT, rowY).stroke();

  // ───────────── Notes (gauche) + Totaux (droite) ─────────────
  const vatAmount = totalHT * (vatRate / 100);
  const totalTTC = totalHT + vatAmount;

  const notesText = data.notes ? `Note : ${data.notes}` : null;
  const notesW = 250;
  doc.font('Helvetica').fontSize(9);
  const notesH = notesText ? doc.heightOfString(notesText, { width: notesW }) + 14 : 0;
  const totalsH = vatRate > 0 ? 18 + 18 + 30 : 30;

  let blockY = rowY + 16;
  if (blockY + Math.max(notesH, totalsH) > MAX_Y) {
    blockY = newPlainPage();
  }

  // Notes à gauche
  if (notesText) {
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(9).text('Remarques', M, blockY);
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(notesText.replace(/^Note : /, ''), M, blockY + 13, {
      width: notesW,
    });
  }

  // Totaux à droite
  const boxX = 345;
  const boxW = RIGHT - boxX; // 200
  let ty = blockY;
  const totalLine = (label: string, value: string, fill = false) => {
    if (fill) {
      doc.fillColor(navy).rect(boxX, ty, boxW, 24).fill();
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11);
      doc.text(label, boxX + 8, ty + 7, { lineBreak: false });
      doc.text(value, boxX, ty + 7, { width: boxW - 8, align: 'right', lineBreak: false });
      ty += 30;
    } else {
      doc.fillColor(navy).font('Helvetica').fontSize(10);
      doc.text(label, boxX + 8, ty, { lineBreak: false });
      doc.text(value, boxX, ty, { width: boxW - 8, align: 'right', lineBreak: false });
      ty += 18;
    }
  };

  if (vatRate > 0) {
    totalLine('Total HT', euro(totalHT));
    totalLine(`TVA ${formatRate(vatRate)} %`, euro(vatAmount));
    totalLine('Total TTC', euro(totalTTC), true);
  } else {
    totalLine('TOTAL', euro(totalHT), true);
  }

  let afterY = Math.max(blockY + notesH, ty);

  // ───────────── Signature ─────────────
  const SIG_BLOCK_H = 16 + 64 + 16;
  let sigY = afterY + 28;
  if (sigY + SIG_BLOCK_H > MAX_Y) {
    sigY = newPlainPage();
  }

  const sigX = 350;
  const sigW = RIGHT - sigX; // ~195
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('Bon pour réception — signature', sigX, sigY, {
    width: sigW,
    lineBreak: false,
  });
  const boxTop = sigY + 16;
  if (data.signature && data.signature.startsWith('data:image')) {
    try {
      const base64 = data.signature.split(',')[1] ?? '';
      const img = Buffer.from(base64, 'base64');
      doc.image(img, sigX, boxTop, { fit: [sigW, 64] });
    } catch {
      /* signature illisible : on ignore et on laisse l'emplacement vide */
      doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(sigX, boxTop, sigW, 60).stroke();
    }
  } else {
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(sigX, boxTop, sigW, 60).stroke();
  }

  // ───────────── Pied de page sur toutes les pages ─────────────
  const nowStr = new Date().toLocaleString('fr-FR');
  const legalBits = [
    company.name,
    company.siret ? `SIRET ${company.siret}` : '',
    company.vat ? `TVA ${company.vat}` : '',
  ].filter(Boolean);
  const legalLine = legalBits.join('   ·   ');

  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(range.start + p);
    doc.page.margins.bottom = 0; // évite toute pagination pendant le dessin du pied
    const fy = PAGE_H - 54;
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(M, fy).lineTo(RIGHT, fy).stroke();
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(legalLine, M, fy + 6, { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.fontSize(8);
    doc.text(`Émis par ${data.user?.name ?? '—'} le ${nowStr}`, M, fy + 19, {
      width: CONTENT_W * 0.7,
      lineBreak: false,
    });
    doc.text(`Page ${p + 1} / ${range.count}`, RIGHT - 110, fy + 19, {
      width: 110,
      align: 'right',
      lineBreak: false,
    });
  }

  doc.end();
}
