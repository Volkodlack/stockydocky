import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Plus, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Field,
  Modal,
  PageLoader,
  EmptyState,
  Badge,
  useConfirm,
} from '../ui';

export interface RefField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
  uppercase?: boolean;
  /** Affiché dans la liste comme colonne secondaire. */
  showInList?: boolean;
}

interface Entity {
  id: string;
  [key: string]: unknown;
  _count?: { articles: number };
}

export function ReferentialPage({
  endpoint,
  title,
  subtitle,
  icon,
  singular,
  fields,
  primaryKey,
  showArticleCount,
}: {
  endpoint: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  singular: string;
  fields: RefField[];
  primaryKey: string;
  showArticleCount?: boolean;
}) {
  const { hasRole } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const canEdit = hasRole('ADMIN', 'EMPLOYEE');
  const canDelete = hasRole('ADMIN');

  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(endpoint)
      .then((res) => setItems(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [endpoint, toast]);

  useEffect(() => load(), [load]);

  const emptyForm = () => {
    const f: Record<string, string> = {};
    fields.forEach((field) => (f[field.key] = ''));
    return f;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };
  const openEdit = (e: Entity) => {
    setEditing(e);
    const f: Record<string, string> = {};
    fields.forEach((field) => (f[field.key] = (e[field.key] as string) ?? ''));
    setForm(f);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      fields.forEach((field) => {
        let val = (form[field.key] ?? '').trim();
        if (field.uppercase) val = val.toUpperCase();
        payload[field.key] = val || null;
      });
      if (editing) {
        await api.put(`${endpoint}/${editing.id}`, payload);
        toast.success(`${singular} mis à jour.`);
      } else {
        await api.post(endpoint, payload);
        toast.success(`${singular} créé.`);
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Entity) => {
    const ok = await confirm({
      title: `Supprimer ${singular.toLowerCase()}`,
      message: `Voulez-vous vraiment supprimer « ${e[primaryKey] as string} » ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`${endpoint}/${e.id}`);
      toast.success(`${singular} supprimé.`);
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const listFields = fields.filter((f) => f.showInList);
  const requiredFilled = fields.filter((f) => f.required).every((f) => (form[f.key] ?? '').trim());

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={loading ? subtitle : `${items.length} ${title.toLowerCase()}`}
        icon={icon}
        actions={
          canEdit && (
            <Button onClick={openCreate}>
              <Plus size={18} /> Ajouter
            </Button>
          )
        }
      />

      <Card padding={false}>
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState
            title={`Aucun ${singular.toLowerCase()}`}
            description="Commencez par en ajouter un."
            action={canEdit && <Button onClick={openCreate}><Plus size={18} /> Ajouter</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((e) => (
              <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{(e[primaryKey] as string) || '—'}</p>
                    {showArticleCount && e._count && (
                      <Badge color="brand">{e._count.articles} article(s)</Badge>
                    )}
                  </div>
                  {listFields.length > 0 && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {listFields
                        .map((f) => (e[f.key] as string) || null)
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(e)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-surface-700"
                      aria-label="Modifier"
                    >
                      <Pencil size={16} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => remove(e)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier ${singular.toLowerCase()}` : `Nouveau ${singular.toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving} disabled={!requiredFilled}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {fields.map((field) => (
            <Field key={field.key} label={field.label} required={field.required}>
              <Input
                type={field.type ?? 'text'}
                value={form[field.key] ?? ''}
                onChange={(ev) =>
                  setForm({ ...form, [field.key]: field.uppercase ? ev.target.value.toUpperCase() : ev.target.value })
                }
                placeholder={field.placeholder}
              />
            </Field>
          ))}
        </div>
      </Modal>
      {dialog}
    </div>
  );
}

/** Petit utilitaire pour fabriquer une page référentiel typée. */
export function makeReferentialPage(config: {
  endpoint: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  singular: string;
  fields: RefField[];
  primaryKey: string;
  showArticleCount?: boolean;
}) {
  const Icon = config.icon;
  return function Page() {
    return <ReferentialPage {...config} icon={<Icon size={22} />} />;
  };
}
