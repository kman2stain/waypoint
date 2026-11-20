import { describe, expect, it } from 'vitest';
import type { Reminder } from '../src/db/schema';
import { alarmTrigger, buildICS, escapeText, foldLine, rrule } from '../src/lib/ics';
import { describeAlert, describeSchedule, nextOccurrence, toLocal } from '../src/lib/schedule';

const base = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'r1',
  title: 'Weekly review',
  kind: 'weekly_review',
  start: '2026-11-22T18:00', // a Sunday
  durationMin: 30,
  repeat: { freq: 'weekly', interval: 1 },
  alertMinutesBefore: [15],
  active: true,
  createdAt: '2026-11-20T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
  ...over,
});

describe('ics', () => {
  it('escapes text', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const line = 'DESCRIPTION:' + 'é'.repeat(60);
    const folded = foldLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split('\r\n')) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('writes alarm triggers', () => {
    expect(alarmTrigger(0)).toBe('PT0M');
    expect(alarmTrigger(15)).toBe('-PT15M');
    expect(alarmTrigger(90)).toBe('-PT1H30M');
    expect(alarmTrigger(1440)).toBe('-P1D');
  });

  it('writes recurrence rules', () => {
    expect(rrule(base())).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(rrule(base({ repeat: { freq: 'weekly', interval: 2, byDay: ['TU', 'TH'] } }))).toBe(
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH',
    );
    expect(rrule(base({ repeat: { freq: 'monthly', interval: 1, until: '2027-12-31' } }))).toBe(
      'RRULE:FREQ=MONTHLY;UNTIL=20271231T235959',
    );
    expect(rrule(base({ repeat: { freq: 'none', interval: 1 } }))).toBeNull();
  });

  it('builds a calendar with floating times, CRLF and one alarm per alert', () => {
    const ics = buildICS(
      [base({ notes: 'Update statuses, export backup', alertMinutesBefore: [15, 0, 15] })],
      new Date('2026-11-20T09:00:00Z'),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain('UID:r1@waypoint');
    expect(ics).toContain('DTSTAMP:20261120T090000Z');
    expect(ics).toContain('DTSTART:20261122T180000\r\n');
    expect(ics).toContain('DTEND:20261122T183000\r\n');
    expect(ics).toContain('DESCRIPTION:Update statuses\\, export backup\\n\\nAdded from Waypoint.');
    expect(ics.match(/BEGIN:VALARM/g)?.length).toBe(2);
    expect(ics).toContain('TRIGGER:PT0M');
    expect(ics).toContain('TRIGGER:-PT15M');
  });

  it('handles an event that ends after midnight', () => {
    const ics = buildICS([base({ start: '2026-11-22T23:30', durationMin: 60, repeat: { freq: 'none', interval: 1 } })]);
    expect(ics).toContain('DTEND:20261123T003000');
    expect(ics).not.toContain('RRULE');
  });
});

describe('schedule', () => {
  const now = new Date(2026, 10, 20, 12, 0); // Fri 20 Nov 2026, 12:00

  it('finds the next weekly occurrence', () => {
    expect(toLocal(nextOccurrence(base(), now)!)).toBe('2026-11-22T18:00');
    // Later the same Sunday, after 18:00 → the following Sunday
    expect(toLocal(nextOccurrence(base(), new Date(2026, 10, 22, 18, 1))!)).toBe('2026-11-29T18:00');
  });

  it('respects interval and chosen weekdays', () => {
    const r = base({ start: '2026-11-17T19:00', repeat: { freq: 'weekly', interval: 2, byDay: ['TU', 'TH'] } });
    expect(toLocal(nextOccurrence(r, now)!)).toBe('2026-12-01T19:00'); // week of 23 Nov is skipped
  });

  it('handles monthly, daily, one-off and until', () => {
    expect(toLocal(nextOccurrence(base({ start: '2026-11-01T09:00', repeat: { freq: 'monthly', interval: 1 } }), now)!)).toBe(
      '2026-12-01T09:00',
    );
    expect(toLocal(nextOccurrence(base({ start: '2026-11-19T07:30', repeat: { freq: 'daily', interval: 3 } }), now)!)).toBe(
      '2026-11-22T07:30',
    );
    expect(nextOccurrence(base({ start: '2026-11-19T09:00', repeat: { freq: 'none', interval: 1 } }), now)).toBeNull();
    expect(nextOccurrence(base({ repeat: { freq: 'weekly', interval: 1, until: '2026-11-21' } }), now)).toBeNull();
  });

  it('describes schedules and alerts in plain words', () => {
    expect(describeSchedule(base())).toBe('Weekly on Sun at 18:00 · 30 min');
    expect(
      describeSchedule(base({ start: '2026-11-17T19:00', durationMin: 60, repeat: { freq: 'weekly', interval: 2, byDay: ['TH', 'TU'] } })),
    ).toBe('Every 2 weeks on Tue, Thu at 19:00 · 60 min');
    expect(describeSchedule(base({ start: '2026-11-01T09:00', repeat: { freq: 'monthly', interval: 1 } }))).toBe(
      'Monthly on the 1st at 09:00 · 30 min',
    );
    expect(describeAlert(0)).toBe('At the time');
    expect(describeAlert(60)).toBe('1 hour before');
    expect(describeAlert(1440)).toBe('1 day before');
  });
});
