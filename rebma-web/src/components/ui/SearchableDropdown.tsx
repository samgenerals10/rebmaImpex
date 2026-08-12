import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  sublabel?: string;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchThreshold?: number;
}

// Floating, card-style dropdown replacing the app's unstyled native
// <select> elements. Same value/onChange contract a native select has, so
// swapping a call site is a find-and-replace, not a rewrite of the
// surrounding form logic. Search box appears automatically once the list
// is longer than `searchThreshold`; short lists skip straight to the rows.
export default function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  searchThreshold = 7,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value) || null;
  const searchable = options.length > searchThreshold;
  const filtered = searchable && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(Math.max(0, options.findIndex(o => o.value === value)));
      if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (opt: DropdownOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(filtered.length - 1, h + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(0, h - 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) commit(filtered[highlighted]); return; }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="erp-select w-full flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`flex items-center gap-2 min-w-0 truncate ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {selected?.icon}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-[500] mt-1.5 w-full min-w-[220px] rounded-card border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-dropdown)] motion-safe:animate-[dropdown-fade-in_0.15s_ease-out] overflow-hidden"
        >
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
              <Search size={14} className="text-[var(--text-muted)] shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-[var(--text-muted)] text-center">No matches</div>
            )}
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => commit(opt)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    i === highlighted ? 'bg-[var(--accent-soft)]' : ''
                  }`}
                >
                  {opt.icon}
                  <span className="flex-1 min-w-0 truncate text-[var(--text-primary)]">{opt.label}</span>
                  {opt.sublabel && <span className="text-xs text-[var(--text-muted)] shrink-0">{opt.sublabel}</span>}
                  {isSelected && <Check size={15} className="text-[var(--accent)] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
