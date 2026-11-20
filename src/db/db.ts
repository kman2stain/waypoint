// Small promise wrapper over IndexedDB. No library, no network.

export const DB_NAME = 'waypoint';
export const DB_VERSION = 1;

export const STORES = [
  'meta',
  'phases',
  'milestones',
  'projects',
  'notes',
  'wins',
  'reminders',
  'studyLogs',
  'decisions',
] as const;
export type StoreName = (typeof STORES)[number];

export type WriteOp =
  | { type: 'put'; store: StoreName; value: { id: string } }
  | { type: 'delete'; store: StoreName; key: string }
  | { type: 'clear'; store: StoreName };

let dbPromise: Promise<IDBDatabase> | null = null;

function upgrade(db: IDBDatabase, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore('meta', { keyPath: 'id' });
    db.createObjectStore('phases', { keyPath: 'id' }).createIndex('order', 'order');
    const milestones = db.createObjectStore('milestones', { keyPath: 'id' });
    milestones.createIndex('phaseId', 'phaseId');
    milestones.createIndex('status', 'status');
    db.createObjectStore('projects', { keyPath: 'id' }).createIndex('name', 'name');
    const notes = db.createObjectStore('notes', { keyPath: 'id' });
    notes.createIndex('createdAt', 'createdAt');
    notes.createIndex('tags', 'tags', { multiEntry: true });
    db.createObjectStore('wins', { keyPath: 'id' }).createIndex('date', 'date');
    db.createObjectStore('reminders', { keyPath: 'id' });
    db.createObjectStore('studyLogs', { keyPath: 'id' }).createIndex('weekStart', 'weekStart');
    db.createObjectStore('decisions', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
  }
  // Future versions: if (oldVersion < 2) { ... }
}

export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('This browser has no IndexedDB storage.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error('Could not open storage.'));
      req.onblocked = () => reject(new Error('Storage upgrade blocked. Close other Waypoint windows and reopen.'));
    }).catch((err: unknown) => {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }
  return dbPromise;
}

export function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

// ---- change notifications so screens refresh after writes ----
type Listener = (stores: StoreName[]) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange(stores: StoreName[]) {
  for (const fn of listeners) fn(stores);
}

// ---- reads ----
export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return request(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDB();
  return request(db.transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>);
}

// ---- writes: always in one transaction, all-or-nothing ----
export async function write(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const db = await openDB();
  const stores = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const op of ops) {
    const os = tx.objectStore(op.store);
    if (op.type === 'put') os.put(op.value);
    else if (op.type === 'delete') os.delete(op.key);
    else os.clear();
  }
  await transactionDone(tx);
  emitChange(stores);
}

export const put = (store: StoreName, value: { id: string }) => write([{ type: 'put', store, value }]);
export const remove = (store: StoreName, key: string) => write([{ type: 'delete', store, key }]);

/** Tests only: drop the connection and delete the database. */
export async function _resetForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
