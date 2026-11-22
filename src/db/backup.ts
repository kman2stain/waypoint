// Export / validate / restore. The backup file is also the future sync format.
import { Checker, isObj, isStr, type Obj } from '../lib/validate';
import { emitChange, openDB, request, STORES, transactionDone, type StoreName } from './db';
import {
  MILESTONE_STATUSES,
  REMINDER_KINDS,
  SCHEMA_VERSION,
  type Meta,
  type Milestone,
  type Note,
  type Phase,
  type Project,
  type Reminder,
  type Win,
} from './schema';

export interface BackupData {
  meta: Meta;
  phases: Phase[];
  milestones: Milestone[];
  projects: Project[];
  notes: Note[];
  wins: Win[];
  reminders: Reminder[];
  /** Arrive in later milestones; carried through unchanged. */
  studyLogs: { id: string }[];
  decisions: { id: string }[];
}

export interface BackupFile {
  app: 'waypoint';
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: BackupData;
}

const LIST_STORES = STORES.filter((s): s is Exclude<StoreName, 'meta'> => s !== 'meta');

// ---------------------------------------------------------------- export

export async function readAll(): Promise<BackupData> {
  const db = await openDB();
  const tx = db.transaction([...STORES], 'readonly');
  const done = transactionDone(tx);
  const lists = await Promise.all(LIST_STORES.map((s) => request(tx.objectStore(s).getAll())));
  const meta = (await request(tx.objectStore('meta').get('meta'))) as Meta | undefined;
  await done;
  if (!meta) throw new Error('Nothing to export yet.');
  const data = { meta } as BackupData;
  LIST_STORES.forEach((s, i) => {
    (data as unknown as Record<string, unknown[]>)[s] = lists[i];
  });
  return data;
}

export async function createBackup(appVersion: string, now: Date = new Date()): Promise<BackupFile> {
  return { app: 'waypoint', schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: now.toISOString(), data: await readAll() };
}

export function backupFileName(exportedAt: string): string {
  return `waypoint-backup-${exportedAt.slice(0, 10)}.json`;
}

export function summarize(data: BackupData) {
  return {
    phases: data.phases.length,
    milestones: data.milestones.length,
    projects: data.projects.length,
    evidence: data.milestones.reduce((n, m) => n + m.evidence.length, 0),
    notes: data.notes.length,
    reminders: data.reminders.length,
    wins: data.wins.length,
  };
}

export async function markExported(at: Date = new Date()): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('meta', 'readwrite');
  const done = transactionDone(tx);
  const meta = (await request(tx.objectStore('meta').get('meta'))) as Meta | undefined;
  if (meta) tx.objectStore('meta').put({ ...meta, lastExportAt: at.toISOString() });
  await done;
  emitChange(['meta']);
}

// ---------------------------------------------------------------- validation

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; errors: string[] };

const MAX_BYTES = 20 * 1024 * 1024;

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BYTES) return { ok: false, errors: ['The file is too large to be a Waypoint backup.'] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This file isn't valid JSON, so it can't be a Waypoint backup."] };
  }
  return validateBackup(json);
}

export function validateBackup(json: unknown): ParseResult {
  if (!isObj(json) || json.app !== 'waypoint') {
    return { ok: false, errors: ["This isn't a Waypoint backup file."] };
  }
  if (typeof json.schemaVersion !== 'number') return { ok: false, errors: ['The backup has no schema version.'] };
  if (json.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: ['This backup was made by a newer version of Waypoint. Update the app (close and reopen it), then try again.'],
    };
  }

  const c = new Checker();
  c.dateTime(json, 'exportedAt', 'file');
  c.str(json, 'appVersion', 'file', { optional: true });
  const data = json.data;
  if (!isObj(data)) return { ok: false, errors: ['file.data: is missing'] };

  // meta
  if (!isObj(data.meta)) c.fail('data.meta', 'is missing');
  else {
    const m = data.meta;
    if (m.id !== 'meta') c.fail('data.meta.id', 'must be "meta"');
    c.num(m, 'schemaVersion', 'data.meta', { int: true, min: 1 });
    c.dateTime(m, 'seededAt', 'data.meta');
    c.date(m, 'startDate', 'data.meta', { optional: true });
    c.dateTime(m, 'lastExportAt', 'data.meta', { optional: true });
  }

  const ids: Record<string, Set<string>> = {};
  const list = (key: Exclude<StoreName, 'meta'>, check: (r: Obj, path: string) => void) => {
    const arr = data[key];
    const seen = (ids[key] = new Set());
    if (arr === undefined) return; // older backups may lack newer lists
    if (!Array.isArray(arr)) return c.fail(`data.${key}`, 'must be a list');
    arr.forEach((r, i) => {
      const path = `data.${key}[${i}]`;
      if (!isObj(r)) return c.fail(path, 'must be an object');
      if (!isStr(r.id) || !r.id) return c.fail(`${path}.id`, 'is missing');
      if (seen.has(r.id)) c.fail(`${path}.id`, `duplicate id "${r.id}"`);
      seen.add(r.id);
      check(r, path);
    });
  };
  const base = (r: Obj, p: string) => {
    c.dateTime(r, 'createdAt', p);
    c.dateTime(r, 'updatedAt', p);
  };

  list('phases', (r, p) => {
    base(r, p);
    c.num(r, 'order', p);
    c.str(r, 'title', p, { nonEmpty: true });
    c.num(r, 'monthsFrom', p, { min: 0 });
    c.num(r, 'monthsTo', p, { min: 0 });
  });
  list('projects', (r, p) => {
    base(r, p);
    c.str(r, 'name', p, { nonEmpty: true });
    c.bool(r, 'archived', p);
  });
  list('milestones', (r, p) => {
    base(r, p);
    c.str(r, 'phaseId', p);
    c.num(r, 'order', p);
    c.str(r, 'title', p, { nonEmpty: true });
    c.oneOf(r, 'kind', p, ['task', 'gate']);
    c.num(r, 'gateMonth', p, { optional: true, min: 0 });
    c.oneOf(r, 'status', p, MILESTONE_STATUSES);
    c.date(r, 'targetDate', p, { optional: true });
    c.str(r, 'notes', p);
    c.str(r, 'projectId', p, { optional: true });
    if (!Array.isArray(r.evidence)) c.fail(`${p}.evidence`, 'must be a list');
    else
      r.evidence.forEach((e, j) => {
        const ep = `${p}.evidence[${j}]`;
        if (!isObj(e)) return c.fail(ep, 'must be an object');
        c.str(e, 'id', ep, { nonEmpty: true });
        c.str(e, 'text', ep, { nonEmpty: true });
        c.date(e, 'date', ep, { optional: true });
        c.str(e, 'confirmedBy', ep, { optional: true });
      });
  });
  list('notes', (r, p) => {
    base(r, p);
    c.str(r, 'text', p);
    c.strArray(r, 'tags', p);
    c.str(r, 'milestoneId', p, { optional: true });
    c.str(r, 'projectId', p, { optional: true });
  });
  list('wins', (r, p) => {
    base(r, p);
    c.str(r, 'title', p, { nonEmpty: true });
    c.num(r, 'before', p, { optional: true });
    c.num(r, 'after', p, { optional: true });
    c.str(r, 'unit', p, { optional: true });
    c.date(r, 'date', p, { optional: true });
    c.str(r, 'source', p, { optional: true });
    c.str(r, 'context', p, { optional: true });
    c.str(r, 'milestoneId', p, { optional: true });
    c.str(r, 'projectId', p, { optional: true });
  });
  list('reminders', (r, p) => {
    base(r, p);
    c.str(r, 'title', p, { nonEmpty: true });
    c.oneOf(r, 'kind', p, REMINDER_KINDS);
    c.dateTime(r, 'calendarAddedAt', p, { optional: true });
    if (!isStr(r.start) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.start)) c.fail(`${p}.start`, 'must be like 2026-01-31T09:00');
    c.num(r, 'durationMin', p, { min: 1 });
    if (!isObj(r.repeat)) c.fail(`${p}.repeat`, 'is missing');
    else {
      c.oneOf(r.repeat, 'freq', `${p}.repeat`, ['none', 'daily', 'weekly', 'monthly']);
      c.num(r.repeat, 'interval', `${p}.repeat`, { int: true, min: 1 });
      c.strArray(r.repeat, 'byDay', `${p}.repeat`, { optional: true });
      c.date(r.repeat, 'until', `${p}.repeat`, { optional: true });
    }
    if (!Array.isArray(r.alertMinutesBefore) || !r.alertMinutesBefore.every((n) => typeof n === 'number' && n >= 0)) {
      c.fail(`${p}.alertMinutesBefore`, 'must be a list of minutes');
    }
    c.str(r, 'notes', p, { optional: true });
    c.bool(r, 'active', p);
  });
  list('studyLogs', () => {});
  list('decisions', () => {});

  // References must point at records that exist in the same backup.
  if (c.ok) {
    const d = data as unknown as BackupData;
    (d.milestones ?? []).forEach((m, i) => {
      if (!ids.phases.has(m.phaseId)) c.fail(`data.milestones[${i}].phaseId`, 'points to a phase that is not in the backup');
      if (m.projectId && !ids.projects.has(m.projectId)) c.fail(`data.milestones[${i}].projectId`, 'points to a missing project');
    });
    for (const key of ['notes', 'wins'] as const) {
      (d[key] ?? []).forEach((r: Note | Win, i: number) => {
        if (r.milestoneId && !ids.milestones.has(r.milestoneId)) c.fail(`data.${key}[${i}].milestoneId`, 'points to a missing milestone');
        if (r.projectId && !ids.projects.has(r.projectId)) c.fail(`data.${key}[${i}].projectId`, 'points to a missing project');
      });
    }
  }

  if (!c.ok) return { ok: false, errors: c.errors };

  const raw = data as Obj;
  const normalized = { meta: raw.meta } as unknown as BackupData;
  for (const s of LIST_STORES) (normalized as unknown as Record<string, unknown>)[s] = (raw[s] as unknown[] | undefined) ?? [];
  return {
    ok: true,
    backup: {
      app: 'waypoint',
      schemaVersion: json.schemaVersion,
      appVersion: isStr(json.appVersion) ? json.appVersion : 'unknown',
      exportedAt: json.exportedAt as string,
      data: normalized,
    },
  };
}

// ---------------------------------------------------------------- restore

/**
 * Replace everything with the backup's contents in ONE transaction:
 * if anything fails, nothing changes.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([...STORES], 'readwrite');
  const done = transactionDone(tx);
  for (const s of STORES) tx.objectStore(s).clear();
  // The restored data is exactly what that backup held, so it counts as backed up then.
  tx.objectStore('meta').put({ ...backup.data.meta, lastExportAt: backup.exportedAt });
  for (const s of LIST_STORES) {
    for (const r of backup.data[s]) tx.objectStore(s).put(r);
  }
  await done;
  emitChange([...STORES]);
}
