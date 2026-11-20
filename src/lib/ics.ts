// RFC 5545 calendar file for the iPhone Calendar to import. Times are "floating"
// (no time zone), so 18:00 stays 18:00 wherever the phone is.
import type { Reminder } from '../db/schema';
import { effectiveByDay, parseLocal, toLocal } from './schedule';

const CRLF = '\r\n';

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (continuation lines start with one space). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let len = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > limit) {
      parts.push(cur);
      cur = '';
      len = 0;
      limit = 74; // the leading space counts
    }
    cur += ch;
    len += n;
  }
  parts.push(cur);
  return parts.join(CRLF + ' ');
}

/** '2026-11-22T18:00' → '20261122T180000' */
export function floatingStamp(local: string): string {
  return local.replace(/[-:]/g, '') + '00';
}

export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function alarmTrigger(minutesBefore: number): string {
  if (minutesBefore === 0) return 'PT0M';
  const d = Math.floor(minutesBefore / 1440);
  const h = Math.floor((minutesBefore % 1440) / 60);
  const m = minutesBefore % 60;
  let out = '-P';
  if (d) out += `${d}D`;
  if (h || m) out += 'T' + (h ? `${h}H` : '') + (m ? `${m}M` : '');
  return out;
}

export function rrule(r: Pick<Reminder, 'start' | 'repeat'>): string | null {
  const { freq, interval, until } = r.repeat;
  if (freq === 'none') return null;
  const parts = [`FREQ=${freq.toUpperCase()}`];
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (freq === 'weekly') parts.push(`BYDAY=${effectiveByDay(r).join(',')}`);
  // Floating DTSTART needs a floating UNTIL; include the whole last day.
  if (until) parts.push(`UNTIL=${until.replace(/-/g, '')}T235959`);
  return 'RRULE:' + parts.join(';');
}

function eventLines(r: Reminder, now: Date): string[] {
  const end = parseLocal(r.start);
  end.setMinutes(end.getMinutes() + r.durationMin);
  const description = [r.notes?.trim(), 'Added from Waypoint.'].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VEVENT',
    `UID:${r.id}@waypoint`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${floatingStamp(r.start)}`,
    `DTEND:${floatingStamp(toLocal(end))}`,
    `SUMMARY:${escapeText(r.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];
  const rule = rrule(r);
  if (rule) lines.push(rule);
  for (const min of [...new Set(r.alertMinutesBefore)].sort((a, b) => a - b)) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(r.title)}`, `TRIGGER:${alarmTrigger(min)}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function buildICS(reminders: Reminder[], now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Waypoint//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...reminders.flatMap((r) => eventLines(r, now)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
