import { useEffect, useRef, useState } from 'preact/hooks';
import { confirmAction } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { useLeaveGuard } from '../components/useLeaveGuard';
import { write } from '../db/db';
import { useAll } from '../db/hooks';
import { REMINDER_KIND_LABELS, REMINDER_KINDS, type Reminder, type RepeatFreq, type Weekday } from '../db/schema';
import { isISODate } from '../lib/dates';
import { formatDateTime } from '../lib/format';
import { newId } from '../lib/ids';
import { presetReminder, type ReminderDraft } from '../lib/reminderPresets';
import {
  describeAlert,
  describeSchedule,
  effectiveByDay,
  isLocalDateTime,
  nextOccurrence,
  WEEK_ORDER,
  WEEKDAY_NAMES,
} from '../lib/schedule';
import { href, navigate } from '../router';
import { CalendarExport, calendarStatus } from './CalendarExport';

const BACK = href('reminders');
const DURATIONS = [10, 15, 30, 45, 60, 90, 120];
const ALERTS = [0, 5, 10, 15, 30, 60, 1440];
const MAX_ALERTS = 2; // iPhone Calendar shows "Alert" and "Second Alert"
const FREQ_LABEL: Record<RepeatFreq, string> = { none: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const UNIT: Record<RepeatFreq, string> = { none: '', daily: 'day', weekly: 'week', monthly: 'month' };

function toDraft(r: Reminder): ReminderDraft {
  const { id: _i, createdAt: _c, updatedAt: _u, calendarAddedAt: _a, ...rest } = r;
  return JSON.parse(JSON.stringify(rest));
}

export function ReminderDetail(props: { id?: string; newKind?: Reminder['kind'] }) {
  const reminders = useAll<Reminder>('reminders');
  const existing = props.id ? reminders?.find((r) => r.id === props.id) : undefined;

  const [draft, setDraft] = useState<ReminderDraft | null>(null);
  const original = useRef('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (draft || !reminders) return;
    const base = existing ? toDraft(existing) : props.newKind ? presetReminder(props.newKind) : null;
    if (base) {
      original.current = JSON.stringify(base);
      setDraft(base);
    }
  }, [reminders, existing, draft, props.newKind]);

  const dirty = !!draft && JSON.stringify(draft) !== original.current;
  const bypass = useLeaveGuard(dirty, 'reminder');

  if (!reminders) return <p class="muted">Loading…</p>;
  if (props.id && !existing) {
    return (
      <EmptyState title="Reminder not found">
        <a href={BACK}>Back to Reminders</a>
      </EmptyState>
    );
  }
  if (!draft) return null;

  const update = (fn: (d: ReminderDraft) => ReminderDraft) => setDraft((d) => (d ? fn(d) : d));
  const set = <K extends keyof ReminderDraft>(k: K, v: ReminderDraft[K]) => update((d) => ({ ...d, [k]: v }));
  const setRepeat = (patch: Partial<ReminderDraft['repeat']>) => update((d) => ({ ...d, repeat: { ...d.repeat, ...patch } }));

  const [date, time] = draft.start.split('T');
  const setStart = (nextDate: string, nextTime: string) => set('start', `${nextDate}T${nextTime}`);

  const byDay = effectiveByDay(draft);
  const toggleDay = (d: Weekday) => {
    const next = byDay.includes(d) ? byDay.filter((x) => x !== d) : [...byDay, d];
    if (next.length) setRepeat({ byDay: WEEK_ORDER.filter((x) => next.includes(x)) });
  };

  const toggleAlert = (min: number) =>
    update((d) => {
      const has = d.alertMinutesBefore.includes(min);
      if (!has && d.alertMinutesBefore.length >= MAX_ALERTS) return d;
      const next = has ? d.alertMinutesBefore.filter((m) => m !== min) : [...d.alertMinutesBefore, min];
      return { ...d, alertMinutesBefore: next.sort((a, b) => a - b) };
    });

  const valid =
    draft.title.trim().length > 0 &&
    isLocalDateTime(draft.start) &&
    draft.repeat.interval >= 1 &&
    (!draft.repeat.until || (isISODate(draft.repeat.until) && draft.repeat.until >= date));
  const preview = valid ? describeSchedule(draft) : null;
  const next = valid && draft.repeat ? nextOccurrence(draft) : null;

  const build = (now: string): Reminder => {
    const r: Reminder = {
      ...draft,
      title: draft.title.trim(),
      notes: draft.notes?.trim() || undefined,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (r.repeat.freq !== 'weekly') delete r.repeat.byDay;
    if (r.repeat.freq === 'none') {
      delete r.repeat.until;
      r.repeat.interval = 1;
    }
    if (!r.repeat.until) delete r.repeat.until;
    if (!r.notes) delete r.notes;
    if (existing?.calendarAddedAt) r.calendarAddedAt = existing.calendarAddedAt;
    return r;
  };

  const save = async () => {
    if (!valid) return;
    await write([{ type: 'put', store: 'reminders', value: build(new Date().toISOString()) }]);
    bypass.current = true;
    await navigate(BACK);
  };

  const remove = async () => {
    if (!existing) return;
    const inCal = existing.calendarAddedAt ? ' It stays in your Calendar until you delete it there too.' : '';
    const ok = await confirmAction({
      title: 'Delete this reminder?',
      body: `"${existing.title}" will be removed from Waypoint.${inCal}`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await write([{ type: 'delete', store: 'reminders', key: existing.id }]);
    bypass.current = true;
    await navigate(BACK);
  };

  const status = existing ? calendarStatus(existing) : null;

  return (
    <form
      class="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label class="field">
        <span class="field-label">Title</span>
        <input type="text" required value={draft.title} onInput={(e) => set('title', e.currentTarget.value)} />
      </label>

      <label class="field">
        <span class="field-label">Type</span>
        <select value={draft.kind} onChange={(e) => set('kind', e.currentTarget.value as Reminder['kind'])}>
          {REMINDER_KINDS.map((k) => (
            <option key={k} value={k}>
              {REMINDER_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <div class="two-col">
        <label class="field">
          <span class="field-label">{draft.repeat.freq === 'none' ? 'Date' : 'Starts'}</span>
          <input type="date" required value={date} onInput={(e) => e.currentTarget.value && setStart(e.currentTarget.value, time)} />
        </label>
        <label class="field">
          <span class="field-label">Time</span>
          <input
            type="time"
            required
            step={300}
            value={time}
            onInput={(e) => e.currentTarget.value && setStart(date, e.currentTarget.value.slice(0, 5))}
          />
        </label>
      </div>

      <label class="field">
        <span class="field-label">Length</span>
        <select value={String(draft.durationMin)} onChange={(e) => set('durationMin', Number(e.currentTarget.value))}>
          {[...new Set([...DURATIONS, draft.durationMin])]
            .sort((a, b) => a - b)
            .map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
        </select>
      </label>

      <fieldset class="field seg" role="radiogroup">
        <legend class="field-label">Repeat</legend>
        <div class="seg-options seg-4">
          {(['none', 'daily', 'weekly', 'monthly'] as RepeatFreq[]).map((f) => (
            <label key={f} class={draft.repeat.freq === f ? 'seg-option checked' : 'seg-option'}>
              <input type="radio" name="freq" value={f} checked={draft.repeat.freq === f} onChange={() => setRepeat({ freq: f })} />
              {FREQ_LABEL[f]}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.repeat.freq !== 'none' && (
        <>
          <div class="field">
            <label class="field-label" for="interval">
              Every
            </label>
            <div class="inline">
              <select
                id="interval"
                style={{ maxWidth: '6rem' }}
                value={String(draft.repeat.interval)}
                onChange={(e) => setRepeat({ interval: Number(e.currentTarget.value) })}
              >
                {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>
                {UNIT[draft.repeat.freq]}
                {draft.repeat.interval > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {draft.repeat.freq === 'weekly' && (
            <fieldset class="field">
              <legend class="field-label">On</legend>
              <div class="day-picker">
                {WEEK_ORDER.map((d) => (
                  <button
                    type="button"
                    key={d}
                    class={byDay.includes(d) ? 'day on' : 'day'}
                    aria-pressed={byDay.includes(d)}
                    aria-label={WEEKDAY_NAMES[d]}
                    onClick={() => toggleDay(d)}
                  >
                    {WEEKDAY_NAMES[d].slice(0, 2)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {draft.repeat.freq === 'monthly' && Number(date.slice(8)) > 28 && (
            <p class="warn-box small" style={{ margin: 0 }}>
              Months without a {Number(date.slice(8))}th are skipped by the Calendar. Pick a day up to the 28th to get one
              every month.
            </p>
          )}

          <div class="field">
            <label class="field-label" for="until">
              Until <span class="muted">(optional)</span>
            </label>
            <div class="inline">
              <input
                id="until"
                type="date"
                min={date}
                value={draft.repeat.until ?? ''}
                onInput={(e) => setRepeat({ until: e.currentTarget.value || undefined })}
              />
              {draft.repeat.until && (
                <button type="button" class="btn btn-ghost" onClick={() => setRepeat({ until: undefined })}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <fieldset class="field">
        <legend class="field-label">
          Alerts <span class="muted">(up to {MAX_ALERTS})</span>
        </legend>
        <div class="alert-grid">
          {ALERTS.map((m) => {
            const on = draft.alertMinutesBefore.includes(m);
            const full = !on && draft.alertMinutesBefore.length >= MAX_ALERTS;
            return (
              <label key={m} class={on ? 'check on' : full ? 'check disabled' : 'check'}>
                <input type="checkbox" checked={on} disabled={full} onChange={() => toggleAlert(m)} />
                {describeAlert(m)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label class="field">
        <span class="field-label">
          Notes <span class="muted">(shown in the Calendar event)</span>
        </span>
        <textarea rows={3} value={draft.notes ?? ''} onInput={(e) => set('notes', e.currentTarget.value)} />
      </label>

      <label class="check">
        <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.currentTarget.checked)} />
        Active (included when adding reminders to Calendar)
      </label>

      {preview && (
        <div class="card small">
          <strong>{preview}</strong>
          <br />
          <span class="muted">{next ? `Next: ${formatDateTime(next.toISOString())}` : 'No upcoming dates'}</span>
        </div>
      )}

      {existing && (
        <div class="card stack">
          <p style={{ margin: 0 }}>
            <strong>Calendar:</strong>{' '}
            {status === 'new'
              ? 'not added yet.'
              : status === 'added'
                ? `added ${formatDateTime(existing.calendarAddedAt!)}.`
                : 'changed since you added it. Delete the old event in Calendar, then add it again.'}
          </p>
          <button
            type="button"
            class="btn"
            disabled={dirty}
            onClick={() => setExporting(true)}
            title={dirty ? 'Save your changes first' : undefined}
          >
            {status === 'new' ? 'Add to Calendar' : 'Add to Calendar again'}
          </button>
          {dirty && <span class="muted small">Save your changes first.</span>}
        </div>
      )}

      {existing && (
        <div style={{ paddingTop: '0.5rem' }}>
          <button type="button" class="btn btn-ghost btn-danger-text" onClick={remove}>
            Delete reminder
          </button>
        </div>
      )}

      <div class="save-bar">
        <button type="button" class="btn" onClick={() => navigate(BACK)}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={!valid || (!dirty && !!existing)}>
          {existing ? 'Save' : 'Add reminder'}
        </button>
      </div>

      {exporting && existing && <CalendarExport reminders={[existing]} onClose={() => setExporting(false)} />}
    </form>
  );
}
