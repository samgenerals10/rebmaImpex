// rebma-web/src/utils/dateRange.ts
// Helpers for the calendar date filter (components/ui/DateRangeField.tsx).
// A range is two 'YYYY-MM-DD' strings in local time; null means "no limit".
import type { CalendarValue } from '../components/ui/CalendarPicker';

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The last `n` days, ending today (n = 7 gives today and the 6 days before). */
export function lastNDays(n: number): CalendarValue {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (n - 1));
  return { start: dayKey(start), end: dayKey(end) };
}

export function thisMonth(): CalendarValue {
  const now = new Date();
  return { start: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), end: dayKey(now) };
}

/** Start of the first day and end of the last day, as Date objects (null = open). */
export function rangeBounds(value: CalendarValue): { from: Date | null; to: Date | null } {
  const from = value.start ? new Date(`${value.start}T00:00:00`) : null;
  const to = value.end ? new Date(`${value.end}T23:59:59.999`) : null;
  return { from, to };
}

/** True when an ISO timestamp or 'YYYY-MM-DD' date falls inside the range. */
export function inRange(dateLike: string | null | undefined, value: CalendarValue): boolean {
  if (!value.start && !value.end) return true;
  if (!dateLike) return false;
  const t = new Date(dateLike.length === 10 ? `${dateLike}T12:00:00` : dateLike).getTime();
  if (Number.isNaN(t)) return false;
  const { from, to } = rangeBounds(value);
  return (!from || t >= from.getTime()) && (!to || t <= to.getTime());
}

/** Number of calendar days the range covers (at least 1). */
export function rangeDays(value: CalendarValue): number {
  const { from, to } = rangeBounds(value);
  if (!from || !to) return 1;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/** The same-length period just before this one, for "vs previous period" comparisons. */
export function previousRange(value: CalendarValue): CalendarValue {
  const { from } = rangeBounds(value);
  if (!from) return { start: null, end: null };
  const days = rangeDays(value);
  const prevEnd = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - (days - 1));
  return { start: dayKey(prevStart), end: dayKey(prevEnd) };
}

const fmt = (key: string, withYear: boolean) =>
  new Date(`${key}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

/** "3 Feb 2026", "3 Feb to 10 Feb 2026", or the empty label. */
export function rangeLabel(value: CalendarValue, emptyLabel = 'All dates'): string {
  if (!value.start && !value.end) return emptyLabel;
  if (value.start && (!value.end || value.end === value.start)) return fmt(value.start, true);
  if (!value.start) return `Up to ${fmt(value.end!, true)}`;
  const sameYear = value.start.slice(0, 4) === value.end!.slice(0, 4);
  return `${fmt(value.start, !sameYear)} to ${fmt(value.end!, true)}`;
}

export type Granularity = 'day' | 'month';

/** The chart bucket a date falls in. */
export function bucketKeyFor(date: Date, granularity: Granularity): string {
  return granularity === 'day' ? dayKey(date) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Chart buckets covering the range: one per day for up to 62 days, one per
 * month beyond that, so a long range stays readable.
 */
export function trendBuckets(value: CalendarValue): { granularity: Granularity; buckets: { key: string; label: string }[] } {
  const { from, to } = rangeBounds(value);
  const start = from || new Date();
  const end = to || new Date();
  const granularity: Granularity = rangeDays(value) <= 62 ? 'day' : 'month';
  const buckets: { key: string; label: string }[] = [];
  if (granularity === 'day') {
    for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
      buckets.push({ key: dayKey(d), label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    }
  } else {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
      const multiYear = start.getFullYear() !== end.getFullYear();
      buckets.push({ key: bucketKeyFor(d, 'month'), label: d.toLocaleDateString('en-GB', multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' }) });
    }
  }
  return { granularity, buckets };
}
