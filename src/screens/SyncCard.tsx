import { useEffect, useState } from 'preact/hooks';
import { confirmAction } from '../components/ConfirmDialog';
import { REPO_RE } from '../sync/github';
import { clearConfig, DEFAULT_PATH, getConfig, getStatus, onStatus, saveConfig, syncNow, type SyncStatus } from '../sync/sync';

const GUIDE = 'https://github.com/kman2stain/waypoint/blob/main/docs/cloud-sync.md';

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState(getStatus());
  useEffect(() => onStatus(setS), []);
  return s;
}

function lastSyncText(iso?: string): string {
  if (!iso) return 'Not yet';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function SyncCard() {
  const status = useSyncStatus();
  const config = getConfig();
  const [editing, setEditing] = useState(false);

  if (!config || editing) return <SyncForm onDone={() => setEditing(false)} canCancel={!!config} />;

  const disconnect = async () => {
    const ok = await confirmAction({
      title: 'Turn off cloud sync?',
      body: 'This phone stops syncing and forgets the token. Your data stays on this phone, and the cloud file stays in GitHub.',
      confirmLabel: 'Turn off',
      danger: true,
    });
    if (ok) clearConfig();
  };

  return (
    <div class="card stack">
      <dl class="kv">
        <dt>Syncing with</dt>
        <dd style={{ overflowWrap: 'anywhere' }}>
          {config.repo}/{config.path}
        </dd>
        <dt>Last sync</dt>
        <dd>{status.state === 'syncing' ? 'Syncing…' : lastSyncText(status.lastSyncAt)}</dd>
      </dl>
      {status.state === 'error' && status.error && (
        <p role="alert" class="error-text">
          {status.error}
        </p>
      )}
      <p class="muted small" style={{ margin: 0 }}>
        Syncs when you open Waypoint and a few seconds after each change. Changes made in the cloud file show up here at
        the next sync.
      </p>
      <div class="button-row">
        <button
          type="button"
          class="btn btn-primary"
          disabled={status.state === 'syncing'}
          onClick={() => void syncNow(__APP_VERSION__)}
        >
          Sync now
        </button>
        <button type="button" class="btn" onClick={() => setEditing(true)}>
          Change settings
        </button>
        <button type="button" class="btn btn-ghost" onClick={disconnect}>
          Turn off
        </button>
      </div>
    </div>
  );
}

function SyncForm(props: { onDone: () => void; canCancel: boolean }) {
  const current = getConfig();
  const [repo, setRepo] = useState(current?.repo ?? '');
  const [path, setPath] = useState(current?.path ?? DEFAULT_PATH);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    const r = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
    const p = path.trim().replace(/^\/+/, '') || DEFAULT_PATH;
    const t = token.trim() || current?.token || '';
    if (!REPO_RE.test(r)) return setError('Enter the repo as owner/name, e.g. yourname/waypoint-data.');
    if (!p.endsWith('.json')) return setError('The file name must end in .json.');
    if (!t) return setError('Paste your GitHub token.');
    setError(null);
    setBusy(true);
    saveConfig({ repo: r, path: p, token: t });
    await syncNow(__APP_VERSION__);
    setBusy(false);
    props.onDone();
  };

  return (
    <form class="card stack" onSubmit={submit}>
      <p class="muted small" style={{ margin: 0 }}>
        Keep a copy of your data in a <strong>private</strong> GitHub repo, so it syncs automatically and your AI
        assistant can update it when you ask. <a href={GUIDE} target="_blank" rel="noopener noreferrer">
          Setup guide →
        </a>
      </p>
      <label class="field">
        <span class="field-label">Private repo</span>
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="yourname/waypoint-data"
          value={repo}
          onInput={(e) => setRepo(e.currentTarget.value)}
        />
      </label>
      <label class="field">
        <span class="field-label">File</span>
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          value={path}
          onInput={(e) => setPath(e.currentTarget.value)}
        />
      </label>
      <label class="field">
        <span class="field-label">GitHub token</span>
        <input
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          placeholder={current?.token ? 'Saved (leave blank to keep it)' : 'github_pat_…'}
          value={token}
          onInput={(e) => setToken(e.currentTarget.value)}
        />
      </label>
      <p class="muted small" style={{ margin: 0 }}>
        The token is stored only on this phone and is never included in backups. Give it access to this one repo
        only.
      </p>
      {error && (
        <p role="alert" class="error-text">
          {error}
        </p>
      )}
      <div class="button-row">
        <button type="submit" class="btn btn-primary" disabled={busy}>
          {busy ? 'Connecting…' : 'Save and sync'}
        </button>
        {props.canCancel && (
          <button type="button" class="btn" onClick={props.onDone} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
