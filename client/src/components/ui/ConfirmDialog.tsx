import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  open,
  title = 'Confirmer',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          {danger && <AlertTriangle size={20} className="text-red-500" />}
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</div>
    </Modal>
  );
}

/**
 * Hook utilitaire pour une confirmation impérative.
 * Usage : const confirm = useConfirm(); … await confirm({ message: '…' })
 */
interface ConfirmState {
  open: boolean;
  message: ReactNode;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve?: (v: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ open: false, message: '' });

  const confirm = (opts: Omit<ConfirmState, 'open' | 'resolve'>) =>
    new Promise<boolean>((resolve) => {
      setState({ ...opts, open: true, resolve });
    });

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  };
  const handleCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false }));
  };

  const dialog = (
    <ConfirmDialog
      open={state.open}
      message={state.message}
      title={state.title}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, dialog };
}
