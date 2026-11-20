import { useRef, useState } from 'preact/hooks';
import { Modal } from '../components/Modal';
import {
  backupFileName,
  createBackup,
  markExported,
  parseBackup,
  readAll,
  restoreBackup,
  summarize,
  type BackupFile,
} from '../db/backup';
import { useMeta } from '../db/hooks';
import { formatDate, toISODate } from '../lib/dates';
import { shareFileCandidate, shareOrDownload } from '../lib/share';
import { canLeave } from '../router';

type Counts = ReturnType<typeof summarize>;

function describeCounts(c: Counts): string {
  const parts = [
    `${c.milestones} milestones`,
    `${c.evidence} evidence`,
    `${c.notes} notes`,
    `${c.reminders} reminders`,
    `${c.wins} wins`,
  ];
  return parts.join(' · ');
}

function lastBackupText(iso: string | undefined, now = new Date()): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return `${formatDate(toISODate(d))} (${when})`;
}

interface Prepared {
  name: string;
  text: string;
  file: File | null;
  counts: Counts;
}

export function BackupCard() {
  const meta = useMeta();

  // ---- export: step 1 prepares the file, step 2 (a separate tap) shares it,
  // because iOS only opens the share sheet straight from a tap.
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [exportState, setExportState] = useState<'ready' | 'done-shared' | 'done-downloaded'>('ready');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepareExport = async () => {
    setError(null);
    setBusy(true);
    try {
      const backup = await createBackup(__APP_VERSION__);
      const name = backupFileName(backup.exportedAt);
      const text = JSON.stringify(backup, null, 2);
      setPrepared({ name, text, file: shareFileCandidate(name, text, 'application/json'), counts: summarize(backup.data) });
      setExportState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveFile = async () => {
    if (!prepared) return;
    const outcome = await shareOrDownload(prepared.file, prepared.name, prepared.text, 'application/json');
    if (outcome === 'cancelled') return;
    await markExported();
    setExportState(outcome === 'shared' ? 'done-shared' : 'done-downloaded');
  };

  // ---- restore
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; incoming: Counts; current: Counts | null } | null>(null);
  const [restoreErrors, setRestoreErrors] = useState<string[] | null>(null);
  const [restored, setRestored] = useState<string | null>(null);

  const chooseFile = async () => {
    setRestored(null);
    if (!(await canLeave())) return;
    fileInput.current?.click();
  };

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow picking the same file again
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setRestoreErrors(result.errors);
      return;
    }
    let current: Counts | null = null;
    try {
      current = summarize(await readAll());
    } catch {
      current = null;
    }
    setPending({ backup: result.backup, incoming: summarize(result.backup.data), current });
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending.backup);
      setRestored(`Restored the backup from ${formatDate(toISODate(new Date(pending.backup.exportedAt)))}.`);
      setPending(null);
    } catch (e) {
      setRestoreErrors([`Nothing was changed. ${e instanceof Error ? e.message : String(e)}`]);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div class="card stack">
        <dl class="kv">
          <dt>Last backup</dt>
          <dd>{lastBackupText(meta?.lastExportAt)}</dd>
        </dl>
        <p class="muted small" style={{ margin: '0.5rem 0 0' }}>
          Your data lives only on this phone. A backup is one file you keep in iCloud Drive; it restores everything if
          you change or reset your phone.
        </p>
        {error && (
          <p role="alert" class="error-text">
            {error}
          </p>
        )}
        {restored && (
          <p role="status" class="ok-text">
            {restored}
          </p>
        )}
        <div class="button-row">
          <button type="button" class="btn btn-primary" onClick={prepareExport} disabled={busy}>
            Export backup
          </button>
          <button type="button" class="btn" onClick={chooseFile} disabled={busy}>
            Restore from backup
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          class="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onFile}
        />
      </div>

      {/* Export: save-to-Files prompt */}
      <Modal open={!!prepared} title={exportState === 'ready' ? 'Your backup is ready' : 'Backup saved'} onClose={() => setPrepared(null)}>
        {prepared && exportState === 'ready' && (
          <div class="stack">
            <p class="muted small" style={{ margin: 0 }}>
              {prepared.name}
              <br />
              {describeCounts(prepared.counts)}
            </p>
            <ol class="steps">
              <li>
                Tap <strong>Save to Files</strong> below.
              </li>
              <li>
                In the share sheet choose <strong>Save to Files</strong>.
              </li>
              <li>
                Pick <strong>iCloud Drive</strong> (a "Waypoint" folder works well), then tap <strong>Save</strong>.
              </li>
            </ol>
            <div class="modal-actions">
              <button type="button" class="btn" onClick={() => setPrepared(null)}>
                Not now
              </button>
              <button type="button" class="btn btn-primary" onClick={saveFile}>
                Save to Files
              </button>
            </div>
          </div>
        )}
        {prepared && exportState !== 'ready' && (
          <div class="stack">
            <p style={{ margin: 0 }}>
              {exportState === 'done-shared'
                ? 'If you chose Save to Files, your backup is in iCloud Drive. Keep the newest few and delete older ones whenever you like.'
                : `${prepared.name} was downloaded. Move it somewhere safe, such as iCloud Drive.`}
            </p>
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" onClick={() => setPrepared(null)}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore: preview and explicit approval */}
      <Modal open={!!pending} title="Restore this backup?" onClose={() => setPending(null)}>
        {pending && (
          <div class="stack">
            <p style={{ margin: 0 }}>
              Backup from <strong>{formatDate(toISODate(new Date(pending.backup.exportedAt)))}</strong>:
              <br />
              <span class="muted small">{describeCounts(pending.incoming)}</span>
            </p>
            {pending.current && (
              <p style={{ margin: 0 }}>
                Currently on this phone:
                <br />
                <span class="muted small">{describeCounts(pending.current)}</span>
              </p>
            )}
            <p class="warn-box" style={{ margin: 0 }}>
              Restoring <strong>replaces everything</strong> currently in Waypoint with this backup. Anything you added
              since it was made will be lost unless you export first.
            </p>
            <div class="modal-actions">
              <button type="button" class="btn" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" class="btn btn-danger" onClick={confirmRestore} disabled={busy}>
                Replace my data
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore: the file was rejected */}
      <Modal open={!!restoreErrors} title="Can't restore this file" onClose={() => setRestoreErrors(null)}>
        {restoreErrors && (
          <div class="stack">
            <p style={{ margin: 0 }}>Nothing was changed.</p>
            <ul class="muted small error-list">
              {restoreErrors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {restoreErrors.length > 8 && <li>…and {restoreErrors.length - 8} more</li>}
            </ul>
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" onClick={() => setRestoreErrors(null)}>
                OK
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
