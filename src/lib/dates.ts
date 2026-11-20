// Calendar dates are stored as local YYYY-MM-DD strings, never as UTC timestamps,
// so a target date can't shift by a day across time zones.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}

export function parseISODate(s: string): Date {
  const m = ISO_DATE.exec(s);
  if (!m) throw new Error(`Not a date: ${s}`);
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Adds whole months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): Date {
  const d = parseISODate(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

/** Whole months from start to now (0 during the first month). */
export function monthsSince(startIso: string, now: Date = new Date()): number {
  const s = parseISODate(startIso);
  let months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  if (now.getDate() < s.getDate()) months -= 1;
  return months;
}

export function formatDate(iso: string, locale?: string): string {
  return parseISODate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMonth(d: Date, locale?: string): string {
  return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}
