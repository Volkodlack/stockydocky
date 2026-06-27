import { useEffect, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { api, apiError } from '../../api/client';
import type { Article, Zone, Category } from '../../api/types';
import { useToast } from '../../hooks/useToast';
import { Modal, Field, Input, Select, Button } from '../ui';

/**
 * Création rapide d'un article à partir d'un code-barres scanné inconnu.
 * Réutilisable : bouton « Scanner » global, entrées/sorties de stock, etc.
 *
 * `onCreated` reçoit l'article créé (avec zone/catégorie) pour que l'appelant
 * puisse enchaîner (naviguer vers la fiche, l'ajouter à une ligne de mouvement…).
 */
export function QuickAddArticleModal({
  open,
  barcode,
  onClose,
  onCreated,
  initialStock = 0,
  showStock = true,
}: {
  open: boolean;
  barcode: string;
  onClose: () => void;
  onCreated: (article: Article) => void;
  initialStock?: number;
  showStock?: boolean;
}) {
  const toast = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [code, setCode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [salePrice, setSalePrice] = useState('0');
  const [stock, setStock] = useState(String(initialStock));
  const [minStock, setMinStock] = useState('0');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // (Ré)initialise le formulaire à chaque ouverture / nouveau code
  useEffect(() => {
    if (!open) return;
    setReference(barcode);
    setName('');
    setBrand('');
    setCode(barcode);
    setPurchasePrice('0');
    setSalePrice('0');
    setStock(String(initialStock));
    setMinStock('0');
    setZoneId('');
    setCategoryId('');
    Promise.all([api.get('/zones'), api.get('/categories')])
      .then(([z, c]) => {
        setZones(z.data);
        setCategories(c.data);
      })
      .catch(() => {});
  }, [open, barcode, initialStock]);

  const submit = async () => {
    if (!reference.trim()) {
      toast.error('La référence est requise.');
      return;
    }
    if (!name.trim()) {
      toast.error('Le nom est requis.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/articles', {
        reference: reference.trim(),
        barcode: code.trim() || null,
        brand: brand.trim() || null,
        name: name.trim(),
        purchasePrice: Number(purchasePrice) || 0,
        salePrice: Number(salePrice) || 0,
        stock: showStock ? Number(stock) || 0 : 0,
        minStock: Number(minStock) || 0,
        zoneId: zoneId || null,
        categoryId: categoryId || null,
      });
      toast.success(`Article créé : ${res.data.name}`);
      onCreated(res.data as Article);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <PackagePlus size={20} className="text-brand-600" /> Nouvel article
        </span>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Créer l'article
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          Code-barres inconnu — création rapide. Code scanné :{' '}
          <span className="font-mono font-medium">{barcode || '—'}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Référence" required>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence interne" />
          </Field>
          <Field label="Code-barres">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code-barres" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Désignation" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du produit" />
          </Field>
          <Field label="Marque">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marque" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Prix d'achat (€)">
            <Input type="number" min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </Field>
          <Field label="Prix de vente (€)">
            <Input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </Field>
          {showStock && (
            <Field label="Stock initial">
              <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </Field>
          )}
          <Field label="Stock minimum">
            <Input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Zone">
            <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">— Aucune —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                  {z.name ? ` — ${z.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Catégorie">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {!showStock && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Le stock sera renseigné par le mouvement d'entrée en cours.
          </p>
        )}
      </div>
    </Modal>
  );
}
