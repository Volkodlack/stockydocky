import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Trash2, ChevronRight } from 'lucide-react';
import { api, apiError } from '../api/client';
import type { InventoryListItem, InventoryStatus, Zone } from '../api/types';
import { formatDate, INVENTORY_STATUS_LABELS, INVENTORY_TYPE_LABELS } from '../lib/format';
import { useToast } from '../hooks/useToast';
import {
  PageHeader,
  Card,
  Button,
  Select,
  Field,
  Modal,
  Badge,
  PageLoader,
  EmptyState,
  useConfirm,
} from '../components/ui';

const STATUS_COLORS: Record<InventoryStatus, 'amber' | 'green' | 'red'> = {
  IN_PROGRESS: 'amber',
  VALIDATED: 'green',
  CANCELLED: 'red',
};

export function InventoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [list, setList] = useState<InventoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/inventory')
      .then((res) => setList(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (inv: InventoryListItem) => {
    const ok = await confirm({
      title: "Supprimer l'inventaire",
      message: `Supprimer l'inventaire ${inv.reference} ? Les comptages seront perdus.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/inventory/${inv.id}`);
      toast.success('Inventaire supprimé.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Inventaires"
        subtitle="Comptages physiques et régularisation des écarts"
        icon={<ClipboardList size={22} />}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> Nouvel inventaire
          </Button>
        }
      />

      <Card padding={false}>
        {loading ? (
          <PageLoader />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={36} />}
            title="Aucun inventaire"
            description="Lancez un inventaire complet, par zone ou tournant."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={18} /> Nouvel inventaire
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {list.map((inv) => (
              <li key={inv.id}>
                <div className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-slate-50 dark:hover:bg-surface-800/40">
                  <button
                    onClick={() => navigate(`/inventaires/${inv.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      <ClipboardList size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono font-medium text-slate-800 dark:text-slate-100">{inv.reference}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {INVENTORY_TYPE_LABELS[inv.type]}
                        {inv.zone ? ` · ${inv.zone.code}` : ''} · {inv._count?.items ?? 0} article(s) ·{' '}
                        {formatDate(inv.createdAt)}
                      </p>
                    </div>
                    <Badge color={STATUS_COLORS[inv.status]}>{INVENTORY_STATUS_LABELS[inv.status]}</Badge>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {inv.status !== 'VALIDATED' && (
                      <button
                        onClick={() => remove(inv)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {createOpen && (
        <CreateInventoryModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            navigate(`/inventaires/${id}`);
          }}
        />
      )}

      {dialog}
    </div>
  );
}

function CreateInventoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [type, setType] = useState<'FULL' | 'ZONE' | 'ROLLING'>('FULL');
  const [zoneId, setZoneId] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/zones').then((r) => setZones(r.data)).catch(() => {});
  }, []);

  const submit = async () => {
    if (type === 'ZONE' && !zoneId) {
      toast.error('Sélectionnez une zone.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/inventory', {
        type,
        zoneId: type === 'ZONE' ? zoneId : undefined,
      });
      toast.success('Inventaire ouvert.');
      onCreated(res.data.id);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouvel inventaire"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving}>
            Ouvrir l'inventaire
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type d'inventaire" hint="Le stock théorique est figé à l'ouverture.">
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="FULL">Complet — tous les articles actifs</option>
            <option value="ZONE">Par zone — articles d'une zone</option>
            <option value="ROLLING">Tournant — sélection manuelle</option>
          </Select>
        </Field>

        {type === 'ZONE' && (
          <Field label="Zone">
            <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">— Choisir une zone —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code}
                  {z.name ? ` — ${z.name}` : ''} ({z._count?.articles ?? 0})
                </option>
              ))}
            </Select>
          </Field>
        )}

        {type === 'ROLLING' && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            L'inventaire tournant sur sélection manuelle d'articles se prépare via l'API. Pour cette interface, privilégiez
            un inventaire complet ou par zone.
          </p>
        )}
      </div>
    </Modal>
  );
}
