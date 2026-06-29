import { useEffect, useState, useCallback } from 'react';
import { UserCog, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { api, apiError } from '../api/client';
import type { User, Role } from '../api/types';
import { ROLE_LABELS, formatDate } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Field,
  Modal,
  PageLoader,
  EmptyState,
  Badge,
  useConfirm,
} from '../components/ui';

const ROLE_COLORS: Record<Role, 'brand' | 'blue' | 'amber'> = {
  ADMIN: 'brand',
  EMPLOYEE: 'blue',
  INVENTORY: 'amber',
};

export function UsersPage() {
  const { user: current } = useAuth();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [active, setActive] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/users')
      .then((res) => setUsers(res.data))
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => load(), [load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setUsername('');
    setPassword('');
    setRole('EMPLOYEE');
    setActive(true);
    setModalOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setName(u.name);
    setUsername(u.username);
    setPassword('');
    setRole(u.role);
    setActive(u.active);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = { name: name.trim(), username: username.trim(), role, active };
        if (password.trim()) payload.password = password;
        await api.put(`/users/${editing.id}`, payload);
        toast.success('Utilisateur mis à jour.');
      } else {
        await api.post('/users', { name: name.trim(), username: username.trim(), password, role });
        toast.success('Utilisateur créé.');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: User) => {
    const ok = await confirm({
      title: "Supprimer l'utilisateur",
      message: `Voulez-vous vraiment supprimer le compte de « ${u.name} » ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('Utilisateur supprimé.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const valid = name.trim() && username.trim() && (editing || password.length >= 6);

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle={loading ? 'Comptes et rôles' : `${users.length} compte(s)`}
        icon={<UserCog size={22} />}
        actions={
          <Button onClick={openCreate}>
            <Plus size={18} /> Nouvel utilisateur
          </Button>
        }
      />

      <Card padding={false}>
        {loading ? (
          <PageLoader />
        ) : users.length === 0 ? (
          <EmptyState title="Aucun utilisateur" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
                    {current?.id === u.id && <Badge color="green">Vous</Badge>}
                    {!u.active && <Badge color="gray">Désactivé</Badge>}
                  </div>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{u.username}</p>
                  <p className="text-xs text-slate-400">Créé le {formatDate(u.createdAt)}</p>
                </div>
                <Badge color={ROLE_COLORS[u.role]}>
                  <ShieldCheck size={12} /> {ROLE_LABELS[u.role]}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(u)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-surface-700"
                    aria-label="Modifier"
                  >
                    <Pencil size={16} />
                  </button>
                  {current?.id !== u.id && (
                    <button
                      onClick={() => remove(u)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving} disabled={!valid}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nom complet" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" />
          </Field>
          <Field label="Identifiant" required hint={editing ? "L'identifiant n'est pas modifiable." : 'Servira à la connexion (ex. jdupont)'}>
            <Input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. jdupont"
              disabled={!!editing}
            />
          </Field>
          <Field label={editing ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} required={!editing} hint="6 caractères minimum">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? 'Laisser vide pour conserver' : '••••••••'}
            />
          </Field>
          <Field label="Rôle">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="ADMIN">Administrateur — accès total</option>
              <option value="EMPLOYEE">Employé — stock & ventes</option>
              <option value="INVENTORY">Inventaire — comptage seul</option>
            </Select>
          </Field>
          {editing && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              <span className="text-sm text-slate-700 dark:text-slate-200">Compte actif (peut se connecter)</span>
            </label>
          )}
        </div>
      </Modal>
      {dialog}
    </div>
  );
}
