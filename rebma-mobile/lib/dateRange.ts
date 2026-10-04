// rebma-mobile/lib/dateRange.ts
// Mobile twin of rebma-web/src/utils/dateRange.ts. Helpers for the calendar
// date filter (components/ui/DateRangeField.tsx). A range is two
// 'YYYY-MM-DD' strings in local time; null means "no limit".
import type { CalendarValue } from '../components/ui/CalendarPicker';

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function lastNDays(n: number): CalendarValue {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1));
  return { start: dayKey(start), end: dayKey(end) };
}

export function thisMonth(): CalendarValue {
  const now = new Date();
  return { start: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), end: dayKey(now) };
}

export function rangeBounds(value: CalendarValue): { from: Date | null; to: Date | null } {
  return {
    from: value.start ? new Date(`${value.start}T00:00:00`) : null,
    to: value.end ? new Date(`${value.end}T23:59:59.999`) : null,
  };
}

export function inRange(dateLike: string | null | undefined, value: CalendarValue): boolean {
  if (!value.start && !value.end) return true;
  if (!dateLike) return false;
  const t = new Date(dateLike.length === 10 ? `${dateLike}T12:00:00` : dateLike).getTime();
  if (Number.isNaN(t)) return false;
  const { from, to } = rangeBounds(value);
  return (!from || t >= from.getTime()) && (!to || t <= to.getTime());
}

export function rangeDays(value: CalendarValue): number {
  const { from, to } = rangeBounds(value);
  if (!from || !to) return 1;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

const fmt = (key: string, withYear: boolean) =>
  new Date(`${key}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

export function rangeLabel(value: CalendarValue, emptyLabel = 'All dates'): string {
  if (!value.start && !value.end) return emptyLabel;
  if (value.start && (!value.end || value.end === value.start)) return fmt(value.start, true);
  if (!value.start) return `Up to ${fmt(value.end!, true)}`;
  const sameYear = value.start.slice(0, 4) === value.end!.slice(0, 4);
  return `${fmt(value.start, !sameYear)} to ${fmt(value.end!, true)}`;
}
