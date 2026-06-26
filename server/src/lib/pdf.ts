import PDFDocument from 'pdfkit';
import type { Response } from 'express';

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

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/** Génère le PDF d'un bon de livraison et le diffuse dans la réponse HTTP. */
export function streamDeliveryNotePdf(res: Response, data: DeliveryData) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${data.number}.pdf"`);
  doc.pipe(res);

  const navy = '#1e293b';
  const indigo = '#4f46e5';
  const muted = '#64748b';

  // En-tête
  doc.fillColor(indigo).fontSize(22).font('Helvetica-Bold').text('BON DE LIVRAISON', 50, 50);
  doc.fillColor(navy).fontSize(11).font('Helvetica').text(`N° ${data.number}`, 50, 80);
  doc
    .fillColor(muted)
    .fontSize(10)
    .text(`Date : ${new Date(data.date).toLocaleDateString('fr-FR')}`, 50, 96)
    .text(`Statut : ${data.status === 'VALIDATED' ? 'Validé' : data.status === 'DRAFT' ? 'Brouillon' : 'Annulé'}`, 50, 110);

  // Émetteur (à personnaliser)
  doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('InventPro', 400, 50, { align: 'right' });
  doc
    .fillColor(muted)
    .fontSize(9)
    .font('Helvetica')
    .text('Gestion de stock', 400, 66, { align: 'right' });

  // Bloc client
  let y = 150;
  doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('Destinataire', 50, y);
  y += 16;
  doc.fillColor('#000').fontSize(10).font('Helvetica');
  if (data.client) {
    doc.text(data.client.name, 50, y);
    y += 14;
    if (data.client.phone) {
      doc.fillColor(muted).text(data.client.phone, 50, y);
      y += 14;
    }
  } else {
    doc.fillColor(muted).text('—', 50, y);
    y += 14;
  }
  const addr = data.address || data.client?.address;
  if (addr) {
    doc.fillColor(muted).fontSize(9).text(addr, 50, y, { width: 250 });
    y += 28;
  }

  // Tableau des produits
  const tableTop = Math.max(y + 10, 250);
  const cols = { ref: 50, name: 140, qty: 360, pu: 410, total: 480 };

  doc.fillColor(indigo).rect(50, tableTop, 495, 22).fill();
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('Référence', cols.ref + 5, tableTop + 7);
  doc.text('Désignation', cols.name, tableTop + 7);
  doc.text('Qté', cols.qty, tableTop + 7);
  doc.text('P.U. HT', cols.pu, tableTop + 7);
  doc.text('Total', cols.total, tableTop + 7);

  let rowY = tableTop + 22;
  let grandTotal = 0;
  doc.font('Helvetica').fontSize(9);

  data.items.forEach((item, i) => {
    const lineTotal = item.quantity * item.unitPrice;
    grandTotal += lineTotal;
    if (i % 2 === 0) {
      doc.fillColor('#f1f5f9').rect(50, rowY, 495, 20).fill();
    }
    doc.fillColor('#000');
    doc.text(item.article.reference, cols.ref + 5, rowY + 6, { width: 85 });
    const label = item.article.brand ? `${item.article.brand} ${item.article.name}` : item.article.name;
    doc.text(label, cols.name, rowY + 6, { width: 210 });
    doc.text(String(item.quantity), cols.qty, rowY + 6);
    doc.text(euro(item.unitPrice), cols.pu, rowY + 6);
    doc.text(euro(lineTotal), cols.total, rowY + 6);
    rowY += 20;
  });

  // Total
  doc.fillColor(navy).rect(360, rowY + 6, 185, 24).fill();
  doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL HT', cols.pu - 40, rowY + 13);
  doc.text(euro(grandTotal), cols.total, rowY + 13);

  let bottom = rowY + 50;

  if (data.notes) {
    doc.fillColor(muted).fontSize(9).font('Helvetica').text(`Note : ${data.notes}`, 50, bottom, { width: 495 });
    bottom += 30;
  }

  // Signature
  bottom = Math.max(bottom, 650);
  doc.fillColor(navy).fontSize(10).font('Helvetica-Bold').text('Signature du client', 350, bottom);
  if (data.signature && data.signature.startsWith('data:image')) {
    try {
      const base64 = data.signature.split(',')[1];
      const img = Buffer.from(base64, 'base64');
      doc.image(img, 350, bottom + 16, { fit: [180, 70] });
    } catch {
      /* signature illisible : on ignore */
    }
  } else {
    doc.strokeColor('#cbd5e1').rect(350, bottom + 16, 180, 60).stroke();
  }

  doc
    .fillColor(muted)
    .fontSize(8)
    .font('Helvetica')
    .text(
      `Émis par ${data.user?.name ?? '—'} le ${new Date().toLocaleString('fr-FR')}`,
      50,
      770,
      { align: 'center', width: 495 },
    );

  doc.end();
}
