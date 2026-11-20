import { useState } from 'preact/hooks';
import { Link } from '../components/Link';
import { Chevron } from '../components/StatusIcon';
import { useAll } from '../db/hooks';
import { REMINDER_KIND_LABELS, REMINDER_KINDS, type Reminder } from '../db/schema';
import { formatDateTime } from '../lib/format';
import { describeSchedule, nextOccurrence } from '../lib/schedule';
import { href } from '../router';
import { CalendarExport, calendarStatus } from './CalendarExport';

const STATUS_TEXT = { new: 'Not in Calendar yet', added: 'In Calendar', changed: 'Changed since added to Calendar' } as const;

export function Reminders() {
  const reminders = useAll<Reminder>('reminders');
  const [exporting, setExporting] = useState<Reminder[] | null>(null);

  if (!reminders) return <p class="muted">Loading…</p>;

  const sorted = [...reminders].sort((a, b) => Number(b.active) - Number(a.active) || a.start.localeCompare(b.start));
  const pending = reminders.filter((r) => r.active && calendarStatus(r) !== 'added');
  const hasBackupReminder = reminders.some((r) => r.kind === 'backup');

  return (
    <div>
      <p class="muted" style={{ marginTop: 0 }}>
        Reminders go to your iPhone <strong>Calendar</strong>, which handles the alerts, even when Waypoint is closed.
      </p>

      {reminders.length > 0 && (
        <>
          <ul class="list">
            {sorted.map((r) => {
              const next = r.active ? nextOccurrence(r) : null;
              const status = calendarStatus(r);
              return (
                <li key={r.id}>
                  <Link class="row" href={href('reminders', 'r', r.id)}>
                    <span class="row-main">
                      <span class="row-title">
                        {r.title}
                        {!r.active && <span class="badge badge-muted">Paused</span>}
                      </span>
                      <span class="row-sub">{describeSchedule(r)}</span>
                      <span class="row-sub">
                        {r.active && (next ? `Next ${formatDateTime(next.toISOString())}` : 'No upcoming dates')}
                        {r.active && ' · '}
                        <span class={status === 'changed' ? 'warn-text' : undefined}>{STATUS_TEXT[status]}</span>
                      </span>
                    </span>
                    <Chevron />
                  </Link>
                </li>
              );
            })}
          </ul>
          {pending.length > 0 && (
            <button type="button" class="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => setExporting(pending)}>
              Add {pending.length === 1 ? '1 reminder' : `${pending.length} reminders`} to Calendar
            </button>
          )}
        </>
      )}

      <h2 class="section-title">{reminders.length ? 'Add another' : 'Start with a suggestion'}</h2>
      <div class="preset-grid">
        {REMINDER_KINDS.map((k) => (
          <Link key={k} class="btn preset" href={href('reminders', 'new', k)}>
            + {REMINDER_KIND_LABELS[k]}
            {k === 'backup' && !hasBackupReminder && <span class="badge badge-accent">Suggested</span>}
          </Link>
        ))}
      </div>
      <p class="muted small">Suggestions are only filled in for you to edit. Nothing is saved until you tap Save.</p>

      {exporting && <CalendarExport reminders={exporting} onClose={() => setExporting(null)} />}
    </div>
  );
}
