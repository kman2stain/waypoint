import { useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import { write, type WriteOp } from '../db/db';
import type { Reminder } from '../db/schema';
import { buildICS } from '../lib/ics';
import { shareFileCandidate, shareOrDownload } from '../lib/share';

const TYPE = 'text/calendar';

/** Status of a reminder relative to the iPhone Calendar. */
export function calendarStatus(r: Reminder): 'new' | 'added' | 'changed' {
  if (!r.calendarAddedAt) return 'new';
  return r.updatedAt > r.calendarAddedAt ? 'changed' : 'added';
}

/**
 * Hands reminders to the iPhone Calendar as an .ics file. Two routes, because
 * iOS behaves differently in Safari and in home-screen apps:
 *  - "Add to Calendar" opens the file directly (Safari shows "Add All").
 *  - "Save to Files" uses the share sheet; open it from the Files app.
 */
export function CalendarExport(props: { reminders: Reminder[]; onClose: () => void }) {
  const [done, setDone] = useState(false);
  const count = props.reminders.length;
  const name = count === 1 ? `waypoint-${slug(props.reminders[0].title)}.ics` : 'waypoint-reminders.ics';
  const changed = props.reminders.filter((r) => calendarStatus(r) === 'changed');

  const markAdded = async () => {
    const now = new Date().toISOString();
    // Only calendarAddedAt changes; updatedAt stays, so status reads "In Calendar".
    const ops: WriteOp[] = props.reminders.map((r) => ({ type: 'put', store: 'reminders', value: { ...r, calendarAddedAt: now } }));
    await write(ops);
    setDone(true);
  };

  const send = async (route: 'open' | 'files') => {
    const text = buildICS(props.reminders);
    const file = route === 'files' ? shareFileCandidate(name, text, TYPE) : null;
    const outcome = await shareOrDownload(file, name, text, TYPE);
    if (outcome !== 'cancelled') await markAdded();
  };

  return (
    <Modal open title={done ? 'Sent to Calendar' : `Add ${count} reminder${count === 1 ? '' : 's'} to Calendar`} onClose={props.onClose}>
      {!done ? (
        <div class="stack">
          <ul class="muted small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {props.reminders.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
          {changed.length > 0 && (
            <p class="warn-box" style={{ margin: 0 }}>
              {changed.length === 1 ? 'One of these was' : `${changed.length} of these were`} already added before. Delete the
              old event in the Calendar app first, or you'll have it twice.
            </p>
          )}
          <ol class="steps">
            <li>
              Tap <strong>Add to Calendar</strong>. Your iPhone shows the events: tap <strong>Add All</strong>.
            </li>
            <li>
              If nothing appears, tap <strong>Save to Files</strong> instead, then open the file in the{' '}
              <strong>Files</strong> app and tap <strong>Add All</strong>.
            </li>
          </ol>
          <p class="muted small" style={{ margin: 0 }}>
            Your Calendar then handles the alerts, even when Waypoint is closed.
          </p>
          <div class="modal-actions">
            <button type="button" class="btn" onClick={props.onClose}>
              Cancel
            </button>
            <button type="button" class="btn" onClick={() => send('files')}>
              Save to Files
            </button>
            <button type="button" class="btn btn-primary" onClick={() => send('open')}>
              Add to Calendar
            </button>
          </div>
        </div>
      ) : (
        <div class="stack">
          <p style={{ margin: 0 }}>
            Check the <strong>Calendar</strong> app: the event{count === 1 ? '' : 's'} should be there with alerts. If you
            later change a reminder here, delete the old event in Calendar and add it again.
          </p>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" onClick={props.onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'reminder'
  );
}
