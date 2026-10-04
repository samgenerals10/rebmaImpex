// rebma-web/src/components/ui/DateRangeField.tsx
// The date filter button used on every table and report filtered by date
// (approved Part C). Shows the chosen day or range and opens the shared
// CalendarPicker in a small panel. Replaces the old "Today / This Week /
// This Month" and "7D / 30D" buttons.
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import CalendarPicker, { type CalendarValue } from './CalendarPicker';
import { rangeLabel } from '../../utils/dateRange';

interface Props {
  value: CalendarValue;
  onChange: (value: CalendarValue) => void;
  mode?: 'single' | 'range';
  /** Shown when nothing is picked; also enables the Clear button. */
  emptyLabel?: string;
  allowClear?: boolean;
  align?: 'left' | 'right';
  className?: string;
  /** Dots under days that have something, keyed 'YYYY-MM-DD'. */
  marks?: Record<string, { color?: string }>;
  /** Told whenever the calendar shows a different month, to load its marks. */
  onVisibleMonthChange?: (month: Date) => void;
}

export default function DateRangeField({ value, onChange, mode = 'range', emptyLabel = 'All dates', allowClear = false, align = 'left', className = '', marks, onVisibleMonthChange }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => (value.start ? new Date(`${value.start}T12:00:00`) : new Date()));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => { if (!open) onVisibleMonthChange?.(month); setOpen(o => !o); }}
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer whitespace-nowrap"
      >
        <CalendarDays className="w-4 h-4 text-[var(--accent)]" />
        {rangeLabel(value, emptyLabel)}
      </button>
      {open && (
        <div className={`absolute z-[400] mt-2 w-[300px] p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <CalendarPicker month={month} onMonthChange={(m) => { setMonth(m); onVisibleMonthChange?.(m); }} mode={mode} value={value} onChange={onChange} marks={marks} />
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            {mode === 'range' ? 'Click one day, or a start day and then an end day.' : 'Click a day.'}
          </p>
          <div className="flex justify-end gap-2 mt-3">
            {allowClear && (value.start || value.end) && (
              <button type="button" onClick={() => { onChange({ start: null, end: null }); setOpen(false); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer" style={{ background: 'var(--accent)' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
