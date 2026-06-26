import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

// ───────────────────────── Pagination ─────────────────────────
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {from}–{to} sur <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft size={16} /> Précédent
        </Button>
        <span className="px-2 text-sm tabular-nums text-slate-600 dark:text-slate-300">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Page suivante"
        >
          Suivant <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── StatCard ─────────────────────────
export function StatCard({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'green' | 'amber' | 'red' | 'slate';
  hint?: string;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-600/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
    green: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    red: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400',
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      {icon && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
        {hint && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
