import type { Reminder, Weekday } from '../db/schema';
import { toLocal, WEEKDAYS } from './schedule';

export type ReminderDraft = Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'calendarAddedAt'>;

/** Next date (today or later) that falls on `day`, at hh:mm; skips today if that time has passed. */
function nextAt(day: Weekday | null, hh: number, mm: number, now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
  if (day === null) {
    if (d <= now) d.setDate(d.getDate() + 1);
    return toLocal(d);
  }
  while (WEEKDAYS[d.getDay()] !== day || d <= now) d.setDate(d.getDate() + 1);
  return toLocal(d);
}

export function presetReminder(kind: Reminder['kind'], now: Date = new Date()): ReminderDraft {
  switch (kind) {
    case 'weekly_review':
      return {
        kind,
        title: 'Weekly review',
        start: nextAt('SU', 18, 0, now),
        durationMin: 30,
        repeat: { freq: 'weekly', interval: 1, byDay: ['SU'] },
        alertMinutesBefore: [0],
        notes: 'Open Waypoint: update milestone statuses, add evidence, capture wins, then export a backup.',
        active: true,
      };
    case 'study_block':
      return {
        kind,
        title: 'Study block',
        start: nextAt('TU', 19, 0, now),
        durationMin: 90,
        repeat: { freq: 'weekly', interval: 1, byDay: ['TU', 'TH'] },
        alertMinutesBefore: [10],
        notes: 'SQL / PL-300. Phone on Do Not Disturb.',
        active: true,
      };
    case 'backup':
      return {
        kind,
        title: 'Export your Waypoint backup',
        start: nextAt('SU', 18, 30, now),
        durationMin: 10,
        repeat: { freq: 'weekly', interval: 2, byDay: ['SU'] },
        alertMinutesBefore: [0],
        notes: 'Waypoint → More → Export backup → Save to Files → iCloud Drive.',
        active: true,
      };
    case 'one_off':
      return {
        kind,
        title: '',
        start: nextAt(null, 9, 0, now),
        durationMin: 30,
        repeat: { freq: 'none', interval: 1 },
        alertMinutesBefore: [15],
        notes: '',
        active: true,
      };
  }
}
