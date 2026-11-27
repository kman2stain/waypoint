// Cloud sync: keeps this phone's data and one JSON file in a private GitHub repo in step.
// The file uses the backup format, so it can also be restored by hand.
//
// One sync: read the cloud file → read this phone → three-way merge with the copy
// from the last sync → save the result on the phone and in the cloud.
// Nothing is written if the cloud file is invalid or the merge would be invalid.
import { parseBackup, readAll, validateBackup, type BackupData, type BackupFile } from '../db/backup';
import { emitChange, openDB, STORES, subscribe, transactionDone } from '../db/db';
import { SCHEMA_VERSION } from '../db/schema';
import { readFile, SyncError, writeFile, type SyncConfig } from './github';
import { LIST_KEYS, mergeData, sameData } from './merge';

// ---------------------------------------------------------------- settings storage
// Kept in localStorage, not IndexedDB, so the token never ends up in a backup file.

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

let kv: KV = (() => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* storage blocked */
  }
  return memoryKV();
})();

/** Tests only. */
export function _setStorageForTests(s?: KV) {
  kv = s ?? memoryKV();
}

const KEY = {
  config: 'waypoint.sync.config',
  base: 'waypoint.sync.base',
  sha: 'waypoint.sync.sha',
  lastAt: 'waypoint.sync.lastAt',
};

export const DEFAULT_PATH = 'waypoint.json';

export function getConfig(): SyncConfig | null {
  try {
    const c = JSON.parse(kv.getItem(KEY.config) ?? 'null') as SyncConfig | null;
    return c && c.repo && c.token ? { ...c, path: c.path || DEFAULT_PATH } : null;
  } catch {
    return null;
  }
}

export function saveConfig(c: SyncConfig) {
  const prev = getConfig();
  if (!prev || prev.repo !== c.repo || prev.path !== c.path) {
    // A different file: the last-sync copy no longer applies.
    kv.removeItem(KEY.base);
    kv.removeItem(KEY.sha);
    kv.removeItem(KEY.lastAt);
  }
  kv.setItem(KEY.config, JSON.stringify(c));
  setStatus({ state: 'idle', lastSyncAt: kv.getItem(KEY.lastAt) ?? undefined });
}

export function clearConfig() {
  for (const k of Object.values(KEY)) kv.removeItem(k);
  setStatus({ state: 'off' });
}

function loadBase(): BackupData | undefined {
  try {
    return (JSON.parse(kv.getItem(KEY.base) ?? 'null') as BackupData | null) ?? undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- status

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncAt?: string;
  error?: string;
}

let status: SyncStatus = getConfig()
  ? { state: 'idle', lastSyncAt: kv.getItem(KEY.lastAt) ?? undefined }
  : { state: 'off' };
const statusListeners = new Set<(s: SyncStatus) => void>();

export function getStatus(): SyncStatus {
  return status;
}

export function onStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function setStatus(s: SyncStatus) {
  status = s;
  for (const fn of statusListeners) fn(s);
}

// ---------------------------------------------------------------- local changes

let applying = false;
let changeSeq = 0;
const localChangeListeners = new Set<() => void>();

subscribe(() => {
  if (applying) return;
  changeSeq++;
  for (const fn of localChangeListeners) fn();
});

/** Replace the phone's data with the merged copy in one transaction. */
async function applyLocal(data: BackupData): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([...STORES], 'readwrite');
  const done = transactionDone(tx);
  for (const s of STORES) tx.objectStore(s).clear();
  tx.objectStore('meta').put(data.meta);
  for (const k of LIST_KEYS) for (const r of data[k]) tx.objectStore(k).put(r);
  await done;
  applying = true;
  try {
    emitChange([...STORES]);
  } finally {
    applying = false;
  }
}

// ---------------------------------------------------------------- one sync

type Outcome = 'ok' | 'retry';

async function syncOnce(c: SyncConfig, appVersion: string, now: Date): Promise<Outcome> {
  const remote = await readFile(c);
  let remoteData: BackupData | undefined;
  if (remote && remote.text.trim()) {
    const parsed = parseBackup(remote.text);
    if (!parsed.ok) {
      throw new SyncError(
        `The cloud file has problems, so nothing was changed. ${parsed.errors.slice(0, 3).join('; ')}${
          parsed.errors.length > 3 ? ` (and ${parsed.errors.length - 3} more)` : ''
        }`,
      );
    }
    remoteData = parsed.backup.data;
  }

  const seq = changeSeq;
  const local = await readAll();
  const merged = remoteData ? mergeData(loadBase(), local, remoteData) : local;
  const file: BackupFile = {
    app: 'waypoint',
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    data: merged,
  };
  const check = validateBackup(JSON.parse(JSON.stringify(file)));
  if (!check.ok) {
    throw new SyncError(`The two copies can't be combined, so nothing was changed. ${check.errors.slice(0, 3).join('; ')}`);
  }

  if (!sameData(merged, local)) {
    if (changeSeq !== seq) return 'retry'; // edited while we were merging
    await applyLocal(merged);
  }

  let sha = remote?.sha ?? null;
  if (!remoteData || !sameData(merged, remoteData)) {
    try {
      sha = await writeFile(c, `${JSON.stringify(file, null, 2)}\n`, sha, `Sync from Waypoint ${appVersion}`);
    } catch (e) {
      if (e instanceof SyncError && e.kind === 'conflict') return 'retry';
      throw e;
    }
  }

  kv.setItem(KEY.base, JSON.stringify(merged));
  if (sha) kv.setItem(KEY.sha, sha);
  kv.setItem(KEY.lastAt, now.toISOString());
  return 'ok';
}

let running: Promise<void> | null = null;

/** Sync now. Concurrent calls share one run. */
export function syncNow(appVersion: string, now: () => Date = () => new Date()): Promise<void> {
  if (running) return running;
  const c = getConfig();
  if (!c) {
    setStatus({ state: 'off' });
    return Promise.resolve();
  }
  running = (async () => {
    setStatus({ ...status, state: 'syncing', error: undefined });
    try {
      for (let attempt = 0; ; attempt++) {
        const when = now();
        if ((await syncOnce(c, appVersion, when)) === 'ok') {
          setStatus({ state: 'idle', lastSyncAt: when.toISOString() });
          return;
        }
        if (attempt >= 2) throw new SyncError('The data kept changing during sync. Try again.');
      }
    } catch (e) {
      setStatus({
        state: 'error',
        lastSyncAt: kv.getItem(KEY.lastAt) ?? undefined,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      running = null;
    }
  })();
  return running;
}

// ---------------------------------------------------------------- automatic sync

const DEBOUNCE_MS = 3000;

/** Sync on open, when the app comes back to the screen, when back online, and shortly after each edit. */
export function startAutoSync(appVersion: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    if (getConfig() && navigator.onLine !== false) void syncNow(appVersion);
  };
  const onLocalChange = () => {
    if (!getConfig()) return;
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') run();
    else if (timer) run(); // leaving the app: send pending edits now
  };
  localChangeListeners.add(onLocalChange);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', run);
  run();
  return () => {
    clearTimeout(timer);
    localChangeListeners.delete(onLocalChange);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', run);
  };
}
