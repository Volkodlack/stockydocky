import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { prisma } from '../config/prisma';
import { asyncHandler, authenticate } from '../middleware/auth';
import { staff } from '../middleware/roles';
import { applyMovement } from '../lib/stock';
import { badRequest, logAction } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// Stockage en mémoire (fichier CSV léger), limite 5 Mo
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Normalise un en-tête de colonne : minuscule, sans accents ni espaces. */
function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/** Convertit une cellule en nombre (gère la virgule décimale française). */
function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(String(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

interface ImportRow {
  reference?: string;
  barcode?: string;
  brand?: string;
  name?: string;
  description?: string;
  purchaseprice?: string;
  saleprice?: string;
  stock?: string;
  minstock?: string;
  zone?: string;
  category?: string;
}

interface ImportReport {
  total: number;
  created: number;
  updated: number;
  stockAdded: number;
  errors: Array<{ ligne: number; reference?: string; message: string }>;
}

// POST /api/import/articles — import CSV (création/MAJ articles + entrées de stock)
router.post(
  '/articles',
  staff,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Fichier CSV manquant (champ « file »)');

    let records: ImportRow[];
    try {
      records = parse(req.file.buffer, {
        columns: (header: string[]) => header.map(normalizeKey),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter: [';', ','],
        relax_column_count: true,
      }) as ImportRow[];
    } catch (e) {
      throw badRequest('CSV illisible : ' + (e as Error).message);
    }

    const report: ImportReport = {
      total: records.length,
      created: 0,
      updated: 0,
      stockAdded: 0,
      errors: [],
    };

    // Caches pour limiter les requêtes (zones / catégories)
    const zoneCache = new Map<string, string>(); // code -> id
    const categoryCache = new Map<string, string>(); // name -> id

    async function resolveZone(code?: string): Promise<string | null> {
      const c = code?.trim();
      if (!c) return null;
      const key = c.toLowerCase();
      if (zoneCache.has(key)) return zoneCache.get(key)!;
      const zone = await prisma.zone.upsert({
        where: { code: c },
        update: {},
        create: { code: c },
      });
      zoneCache.set(key, zone.id);
      return zone.id;
    }

    async function resolveCategory(nameRaw?: string): Promise<string | null> {
      const n = nameRaw?.trim();
      if (!n) return null;
      const key = n.toLowerCase();
      if (categoryCache.has(key)) return categoryCache.get(key)!;
      const cat = await prisma.category.upsert({
        where: { name: n },
        update: {},
        create: { name: n },
      });
      categoryCache.set(key, cat.id);
      return cat.id;
    }

    let line = 1; // ligne 1 = en-tête
    for (const row of records) {
      line += 1;
      const reference = row.reference?.trim();
      const name = row.name?.trim();

      if (!reference) {
        report.errors.push({ ligne: line, message: 'Référence manquante' });
        continue;
      }

      try {
        const zoneId = await resolveZone(row.zone);
        const categoryId = await resolveCategory(row.category);
        const stockToAdd = Math.max(0, Math.trunc(toNumber(row.stock, 0)));

        const existing = await prisma.article.findUnique({ where: { reference } });

        await prisma.$transaction(async (tx) => {
          let articleId: string;

          if (existing) {
            // Mise à jour des champs descriptifs (le stock NE change PAS ici)
            const updated = await tx.article.update({
              where: { id: existing.id },
              data: {
                barcode: row.barcode?.trim() || existing.barcode,
                brand: row.brand?.trim() || existing.brand,
                name: name || existing.name,
                description: row.description?.trim() ?? existing.description,
                purchasePrice: row.purchaseprice ? toNumber(row.purchaseprice) : existing.purchasePrice,
                salePrice: row.saleprice ? toNumber(row.saleprice) : existing.salePrice,
                minStock: row.minstock ? Math.trunc(toNumber(row.minstock)) : existing.minStock,
                zoneId: zoneId ?? existing.zoneId,
                categoryId: categoryId ?? existing.categoryId,
              },
            });
            articleId = updated.id;
            report.updated += 1;
          } else {
            if (!name) throw new Error('Nom manquant (article nouveau)');
            const created = await tx.article.create({
              data: {
                reference,
                barcode: row.barcode?.trim() || null,
                brand: row.brand?.trim() || null,
                name,
                description: row.description?.trim() || null,
                purchasePrice: toNumber(row.purchaseprice),
                salePrice: toNumber(row.saleprice),
                stock: 0, // le stock initial est ajouté via un mouvement auditable
                minStock: Math.trunc(toNumber(row.minstock)),
                zoneId,
                categoryId,
              },
            });
            articleId = created.id;
            report.created += 1;
          }

          // Le stock du CSV est ajouté comme une entrée (traçable dans l'historique)
          if (stockToAdd > 0) {
            await applyMovement(tx, {
              articleId,
              type: 'ENTRY_IMPORT',
              quantity: stockToAdd,
              reason: 'Import CSV',
              reference: req.file?.originalname ?? 'import.csv',
              userId: req.user!.sub,
            });
            report.stockAdded += stockToAdd;
          }
        });
      } catch (e) {
        report.errors.push({ ligne: line, reference, message: (e as Error).message });
      }
    }

    await logAction(req.user!.sub, 'IMPORT_CSV', 'Article', undefined, {
      total: report.total,
      crees: report.created,
      maj: report.updated,
      erreurs: report.errors.length,
    });

    res.json(report);
  }),
);

export default router;
