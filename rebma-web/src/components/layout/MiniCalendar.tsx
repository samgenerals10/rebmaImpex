import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, X } from 'lucide-react';

const TZ_OPTIONS = [
  { label: 'Ghana (GMT+0)', tz: 'Africa/Accra' },
  { label: 'UK (GMT)', tz: 'Europe/London' },
  { label: 'Poland (CET)', tz: 'Europe/Warsaw' },
  { label: 'Netherlands (CET)', tz: 'Europe/Amsterdam' },
  { label: 'USA Eastern', tz: 'America/New_York' },
  { label: 'USA Western', tz: 'America/Los_Angeles' },
  { label: 'UAE (GST)', tz: 'Asia/Dubai' },
  { label: 'China (CST)', tz: 'Asia/Shanghai' },
];

interface Reminder { date: string; text: string; }
const STORAGE_KEY = 'rebma-calendar-reminders';
const TZ_KEY = 'rebma-calendar-tz';

function loadReminders(): Reminder[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveReminders(r: Reminder[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
}

export default function MiniCalendar({ isCollapsed }: { isCollapsed?: boolean }) {
  const [tz, setTz] = useState<string>(() => localStorage.getItem(TZ_KEY) || 'Africa/Accra');
  const [now, setNow] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [reminderText, setReminderText] = useState('');
  const [showTzPicker, setShowTzPicker] = useState(false);

  // Update "now" every minute in selected timezone
  useEffect(() => {
    const tick = () => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      setNow(d);
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [tz]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = now.toLocaleString('en-US', { month: 'long', timeZone: tz });
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const hasReminder = (day: number) => reminders.some(r => r.date === dateStr(day));

  const addReminder = (day: number) => {
    if (!reminderText.trim()) return;
    const r: Reminder = { date: dateStr(day), text: reminderText.trim() };
    const updated = [...reminders, r];
    setReminders(updated);
    saveReminders(updated);
    setAddingFor(null);
    setReminderText('');
  };

  const removeReminder = (idx: number) => {
    const updated = reminders.filter((_, i) => i !== idx);
    setReminders(updated);
    saveReminders(updated);
  };

  const changeTz = (newTz: string) => {
    setTz(newTz);
    localStorage.setItem(TZ_KEY, newTz);
    setShowTzPicker(false);
  };

  if (isCollapsed) return null;

  const todayReminders = reminders.filter(r => r.date === todayStr);

  return (
    <div className="px-2 pb-2">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-3 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-muted)]">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowTzPicker(p => !p)}
            className="text-[10px] font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            title="Change timezone"
          >
            {new Date(year, month).toLocaleString('en-US', { month: 'short' })} {year}
          </button>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-muted)]">
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Timezone picker */}
        {showTzPicker && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1.5 space-y-0.5 max-h-36 overflow-y-auto">
            {TZ_OPTIONS.map(opt => (
              <button
                key={opt.tz}
                onClick={() => changeTz(opt.tz)}
                className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-colors ${tz === opt.tz ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Day headers */}
        <div className="grid grid-cols-7 text-center">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <span key={i} className="text-[9px] font-bold text-[var(--text-muted)]">{d}</span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const ds = dateStr(day);
            const isToday = ds === todayStr;
            const hasR = hasReminder(day);
            return (
              <button
                key={i}
                onClick={() => { setAddingFor(ds === addingFor ? null : ds); setReminderText(''); }}
                title={hasR ? 'Has reminder' : 'Add reminder'}
                className={`relative flex items-center justify-center h-6 w-full rounded-lg text-[10px] font-semibold cursor-pointer transition-all ${isToday ? 'bg-[var(--accent)] text-white shadow-sm' : addingFor === ds ? 'bg-[var(--accent-light)] text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--accent-light)] text-[var(--text-secondary)]'}`}
              >
                {day}
                {hasR && !isToday && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Add reminder for selected date */}
        {addingFor && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Reminder for {addingFor}</p>
            <div className="flex gap-1">
              <input
                value={reminderText}
                onChange={e => setReminderText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addReminder(parseInt(addingFor.split('-')[2])); }}
                placeholder="E.g., Board meeting 10am"
                className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => addReminder(parseInt(addingFor.split('-')[2]))}
                className="px-2 py-1.5 bg-[var(--accent)] text-white text-[10px] font-bold rounded-lg cursor-pointer hover:opacity-90"
              >
                Set
              </button>
            </div>
          </div>
        )}

        {/* Today's reminders */}
        {todayReminders.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
              <Bell className="w-2.5 h-2.5 text-amber-400" /> Today
            </p>
            {todayReminders.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="flex-1 text-[10px] text-amber-700 dark:text-amber-400 truncate">{r.text}</span>
                <button onClick={() => removeReminder(reminders.indexOf(r))} className="cursor-pointer text-amber-400 hover:text-rose-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Clock in selected TZ */}
        <p className="text-[9px] text-[var(--text-muted)] text-center font-mono">
          {new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' })} · {TZ_OPTIONS.find(o => o.tz === tz)?.label.split(' ')[0] ?? 'Local'}
        </p>
      </div>
    </div>
  );
}
