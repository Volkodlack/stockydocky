import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { api } from '../../api/client';
import type { SearchResultArticle } from '../../api/types';
import { formatEur, stockStatus } from '../../lib/format';

export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResultArticle[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recherche débattue
  useEffect(() => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get('/search', { params: { q } })
        .then((res) => {
          setResults(res.data.articles ?? []);
          setActive(0);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Raccourci clavier « / » pour focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = (a: SearchResultArticle) => {
    navigate(`/articles/${a.id}`);
    setQ('');
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goTo(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un article…  ( / )"
          className="field h-11 pl-10 pr-9"
          aria-label="Recherche globale"
        />
        {q && (
          <button
            onClick={() => {
              setQ('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Effacer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-soft dark:border-slate-800 dark:bg-surface-900">
          {results.map((a, i) => {
            const st = stockStatus(a.stock, a.minStock);
            const dot = st === 'out' ? 'bg-red-500' : st === 'low' ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <button
                key={a.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => goTo(a)}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition ${
                  i === active ? 'bg-brand-50 dark:bg-brand-500/10' : ''
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {a.brand ? `${a.brand} · ` : ''}
                    {a.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {a.reference}
                    {a.zone?.code ? ` · ${a.zone.code}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{a.stock}</p>
                  <p className="text-xs text-slate-400">{formatEur(a.salePrice)}</p>
                </div>
                {i === active && <CornerDownLeft size={14} className="shrink-0 text-slate-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
