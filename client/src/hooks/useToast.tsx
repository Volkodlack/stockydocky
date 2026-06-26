import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastCtx | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter;
      setToasts((list) => [...list, { id, type, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value: ToastCtx = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const conf = {
    success: { icon: CheckCircle2, cls: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300', ic: 'text-emerald-500' },
    error: { icon: XCircle, cls: 'border-red-500/30 text-red-700 dark:text-red-300', ic: 'text-red-500' },
    info: { icon: Info, cls: 'border-brand-500/30 text-brand-700 dark:text-brand-300', ic: 'text-brand-500' },
  }[toast.type];
  const Icon = conf.icon;

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border bg-white/95 px-4 py-3 shadow-soft backdrop-blur dark:bg-surface-900/95 ${conf.cls}`}
      role="alert"
    >
      <Icon size={20} className={`mt-0.5 shrink-0 ${conf.ic}`} />
      <p className="flex-1 text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">{toast.message}</p>
      <button onClick={onClose} className="shrink-0 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200">
        <X size={16} />
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider');
  return ctx;
}
