import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate);

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.join(';');
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(';')).join('\n');
  return `\uFEFF${head}\n${body}`; // BOM pour Excel/accents
}

// GET /api/export/articles.csv
router.get(
  '/articles.csv',
  asyncHandler(async (req, res) => {
    const articles = await prisma.article.findMany({
      include: { zone: true, category: true },
      orderBy: { name: 'asc' },
    });
    const headers = [
      'reference', 'barcode', 'brand', 'name', 'description',
      'purchasePrice', 'salePrice', 'stock', 'minStock', 'zone', 'category', 'active',
    ];
    const rows = articles.map((a) => ({
      reference: a.reference,
      barcode: a.barcode ?? '',
      brand: a.brand ?? '',
      name: a.name,
      description: a.description ?? '',
      purchasePrice: Number(a.purchasePrice),
      salePrice: Number(a.salePrice),
      stock: a.stock,
      minStock: a.minStock,
      zone: a.zone?.code ?? '',
      category: a.category?.name ?? '',
      active: a.active ? 'oui' : 'non',
    }));
    await logAction(req.user!.sub, 'EXPORT_ARTICLES_CSV');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="articles.csv"');
    res.send(toCsv(rows, headers));
  }),
);

// GET /api/export/articles.xlsx
router.get(
  '/articles.xlsx',
  asyncHandler(async (req, res) => {
    const articles = await prisma.article.findMany({
      include: { zone: true, category: true },
      orderBy: { name: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'InventPro';
    const ws = wb.addWorksheet('Articles');
    ws.columns = [
      { header: 'Référence', key: 'reference', width: 16 },
      { header: 'Code-barres', key: 'barcode', width: 16 },
      { header: 'Marque', key: 'brand', width: 16 },
      { header: 'Nom', key: 'name', width: 30 },
      { header: 'Prix achat', key: 'purchasePrice', width: 12 },
      { header: 'Prix vente', key: 'salePrice', width: 12 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Stock min', key: 'minStock', width: 10 },
      { header: 'Zone', key: 'zone', width: 12 },
      { header: 'Catégorie', key: 'category', width: 18 },
      { header: 'Valeur stock', key: 'value', width: 14 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    articles.forEach((a) => {
      ws.addRow({
        reference: a.reference,
        barcode: a.barcode ?? '',
        brand: a.brand ?? '',
        name: a.name,
        purchasePrice: Number(a.purchasePrice),
        salePrice: Number(a.salePrice),
        stock: a.stock,
        minStock: a.minStock,
        zone: a.zone?.code ?? '',
        category: a.category?.name ?? '',
        value: a.stock * Number(a.purchasePrice),
      });
    });
    ['purchasePrice', 'salePrice', 'value'].forEach((k) => {
      ws.getColumn(k).numFmt = '#,##0.00 €';
    });

    await logAction(req.user!.sub, 'EXPORT_ARTICLES_XLSX');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="articles.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }),
);

// GET /api/export/movements.csv
router.get(
  '/movements.csv',
  asyncHandler(async (req, res) => {
    const movements = await prisma.stockMovement.findMany({
      include: { article: { select: { reference: true, name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const headers = ['date', 'type', 'reference', 'article', 'quantite', 'stockAvant', 'stockApres', 'motif', 'utilisateur'];
    const rows = movements.map((m) => ({
      date: m.createdAt.toISOString(),
      type: m.type,
      reference: m.reference ?? '',
      article: `${m.article.reference} - ${m.article.name}`,
      quantite: m.quantity,
      stockAvant: m.stockBefore,
      stockApres: m.stockAfter,
      motif: m.reason ?? '',
      utilisateur: m.user?.name ?? '',
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mouvements.csv"');
    res.send(toCsv(rows, headers));
  }),
);

export default router;
