// rebma-web/src/components/ui/CalendarPicker.tsx
// Web twin of rebma-mobile/components/ui/CalendarPicker.tsx.
//
// The one calendar used wherever a list is filtered by date (approved rule:
// no "Today / This Week / This Month" buttons).
//  * mode 'single': click a day.
//  * mode 'range':  click a start day, then an end day; the days between
//                   are highlighted. The next click starts over.
//  * Arrows, the arrow keys, or a sideways swipe on touch screens change
//    month; the grid slides and fades (and doesn't for people who've asked
//    their device to reduce motion).
//  * `marks` puts a dot under days that have something (e.g. a birthday).
// Dates are 'YYYY-MM-DD' strings in local time.
import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarValue = { start: string | null; end: string | null };

interface Props {
  month: Date;
  onMonthChange: (month: Date) => void;
  mode?: 'single' | 'range';
  value: CalendarValue;
  onChange: (value: CalendarValue) => void;
  marks?: Record<string, { color?: string }>;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarPicker({ month, onMonthChange, mode = 'single', value, onChange, marks }: Props) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const todayKey = toKey(new Date());
  const [direction, setDirection] = useState(0);
  const touchX = useRef<number | null>(null);

  const days = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= count; d++) cells.push(toKey(new Date(year, monthIndex, d)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [year, monthIndex]);

  const go = (delta: number) => {
    setDirection(delta);
    onMonthChange(new Date(year, monthIndex + delta, 1));
  };

  const tap = (key: string) => {
    if (mode === 'range' && value.start && value.start === value.end && key !== value.start) {
      const [a, b] = key < value.start ? [key, value.start] : [value.start, key];
      onChange({ start: a, end: b });
      return;
    }
    onChange({ start: key, end: key });
  };

  const isThisMonth = year === new Date().getFullYear() && monthIndex === new Date().getMonth();

  return (
    <div
      className="select-none"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -40) go(1); else if (dx > 40) go(-1);
        touchX.current = null;
      }}
    >
      <style>{`
        @keyframes rebma-cal-in-next { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
        @keyframes rebma-cal-in-prev { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .rebma-cal-grid { animation: none !important; } }
      `}</style>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => go(-1)} aria-label="Previous month" className="p-2 rounded-xl hover:bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-[var(--text-primary)]">{MONTHS[monthIndex]} {year}</p>
          {!isThisMonth && (
            <button type="button" onClick={() => { setDirection(0); onMonthChange(new Date()); }} className="text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer">
              Back to this month
            </button>
          )}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next month" className="p-2 rounded-xl hover:bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => <span key={w} className="text-center text-[10px] font-semibold text-[var(--text-muted)]">{w}</span>)}
      </div>

      <div
        key={`${year}-${monthIndex}`}
        className="rebma-cal-grid grid grid-cols-7 gap-1"
        style={{ animation: direction ? `${direction > 0 ? 'rebma-cal-in-next' : 'rebma-cal-in-prev'} 220ms ease-out` : undefined }}
      >
        {days.map((key, i) => {
          if (!key) return <div key={`e${i}`} className="aspect-square" />;
          const selected = key === value.start || key === value.end;
          const between = !!value.start && !!value.end && key > value.start && key < value.end;
          const mark = marks?.[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => tap(key)}
              aria-label={key}
              aria-pressed={selected}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-colors cursor-pointer
                ${selected ? 'bg-[var(--accent)] text-white font-bold' : between ? 'bg-[var(--accent-light)] text-[var(--text-primary)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-input)]'}
                ${key === todayKey && !selected ? 'ring-1 ring-[var(--accent)]' : ''}`}
            >
              <span>{Number(key.slice(8))}</span>
              {mark && <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: selected ? '#fff' : (mark.color || 'var(--accent)') }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
