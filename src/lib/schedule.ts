// Recurrence maths for reminders, kept in step with the RRULE written to .ics.
import type { Reminder, Weekday } from '../db/schema';
import { formatDate, toISODate } from './dates';

/** JS getDay() order: 0 = Sunday. */
export const WEEKDAYS: Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};
/** Display order, Monday first. */
export const WEEK_ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isLocalDateTime(s: unknown): s is string {
  return typeof s === 'string' && LOCAL.test(s);
}

export function parseLocal(s: string): Date {
  const m = LOCAL.exec(s);
  if (!m) throw new Error(`Not a local date-time: ${s}`);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

export function toLocal(d: Date): string {
  return `${toISODate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function weekdayOf(local: string): Weekday {
  return WEEKDAYS[parseLocal(local).getDay()];
}

/** Days the rule fires on for weekly reminders (defaults to the start's weekday). */
export function effectiveByDay(r: Pick<Reminder, 'start' | 'repeat'>): Weekday[] {
  return r.repeat.byDay?.length ? r.repeat.byDay : [weekdayOf(r.start)];
}

const DAY = 86_400_000;
const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
/** Monday-based week index (RFC 5545 default WKST=MO). */
const weekNumber = (d: Date) => Math.floor((dayNumber(d) + 3) / 7);

function firesOn(r: Pick<Reminder, 'start' | 'repeat'>, day: Date): boolean {
  const start = parseLocal(r.start);
  if (dayNumber(day) < dayNumber(start)) return false;
  if (r.repeat.until && toISODate(day) > r.repeat.until) return false;
  const n = Math.max(1, r.repeat.interval);
  switch (r.repeat.freq) {
    case 'none':
      return dayNumber(day) === dayNumber(start);
    case 'daily':
      return (dayNumber(day) - dayNumber(start)) % n === 0;
    case 'weekly':
      return (weekNumber(day) - weekNumber(start)) % n === 0 && effectiveByDay(r).includes(WEEKDAYS[day.getDay()]);
    case 'monthly': {
      const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
      return months % n === 0 && day.getDate() === start.getDate();
    }
  }
}

/** The next time this reminder fires at or after `now`, or null if it never will again. */
export function nextOccurrence(r: Pick<Reminder, 'start' | 'repeat'>, now: Date = new Date()): Date | null {
  const start = parseLocal(r.start);
  const from = now > start ? now : start;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 366 * 3; i++) {
    if (firesOn(r, cursor)) {
      const at = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), start.getHours(), start.getMinutes());
      if (at >= now) return at;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const time = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const shortDay = (w: Weekday) => WEEKDAY_NAMES[w].slice(0, 3);

/** "Every 2 weeks on Tue, Thu at 19:00 · 60 min" */
export function describeSchedule(r: Pick<Reminder, 'start' | 'repeat' | 'durationMin'>): string {
  const start = parseLocal(r.start);
  const n = Math.max(1, r.repeat.interval);
  const at = `at ${time(start)}`;
  let text: string;
  switch (r.repeat.freq) {
    case 'none':
      text = `Once on ${formatDate(toISODate(start))} ${at}`;
      break;
    case 'daily':
      text = `${n === 1 ? 'Daily' : `Every ${n} days`} ${at}`;
      break;
    case 'weekly': {
      const days = WEEK_ORDER.filter((d) => effectiveByDay(r).includes(d)).map(shortDay).join(', ');
      text = `${n === 1 ? 'Weekly' : `Every ${n} weeks`} on ${days} ${at}`;
      break;
    }
    case 'monthly':
      text = `${n === 1 ? 'Monthly' : `Every ${n} months`} on the ${ordinal(start.getDate())} ${at}`;
      break;
  }
  if (r.repeat.freq !== 'none' && r.repeat.until) text += `, until ${formatDate(r.repeat.until)}`;
  return `${text} · ${r.durationMin} min`;
}

export function describeAlert(min: number): string {
  if (min === 0) return 'At the time';
  if (min % 1440 === 0) return `${min / 1440} day${min === 1440 ? '' : 's'} before`;
  if (min % 60 === 0) return `${min / 60} hour${min === 60 ? '' : 's'} before`;
  return `${min} min before`;
}
