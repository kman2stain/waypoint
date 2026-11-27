// Three-way merge of two copies of the data (this phone and the cloud file),
// using the copy both sides agreed on at the last sync as the common base.
// Pure functions: no storage, no network.
import type { BackupData } from '../db/backup';
import type { Meta } from '../db/schema';

export const LIST_KEYS = [
  'phases',
  'milestones',
  'projects',
  'notes',
  'wins',
  'reminders',
  'studyLogs',
  'decisions',
] as const;
export type ListKey = (typeof LIST_KEYS)[number];

type Rec = { id: string; updatedAt?: string };

/** JSON with object keys sorted, so two equal records always compare equal. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

/** Which side's newer edit wins when both sides changed the same record. Ties go to the cloud. */
function newer<T extends Rec>(local: T, remote: T): T {
  return (local.updatedAt ?? '') > (remote.updatedAt ?? '') ? local : remote;
}

/**
 * Per record:
 * - changed on one side only → that side's version
 * - changed on both → the one with the later updatedAt
 * - added on one side → kept
 * - deleted on one side and untouched on the other → deleted
 * - deleted on one side but edited on the other → the edit is kept
 * With no base (first sync), nothing counts as deleted: both sides are combined.
 */
export function mergeList<T extends Rec>(base: T[] | undefined, local: T[], remote: T[]): T[] {
  const b = new Map((base ?? []).map((r) => [r.id, r]));
  const l = new Map(local.map((r) => [r.id, r]));
  const r = new Map(remote.map((x) => [x.id, x]));
  const out: T[] = [];
  const ids = [...new Set([...l.keys(), ...r.keys()])];
  for (const id of ids) {
    const lv = l.get(id);
    const rv = r.get(id);
    const bv = b.get(id);
    if (lv && rv) {
      if (same(lv, rv)) out.push(lv);
      else if (bv && same(lv, bv)) out.push(rv);
      else if (bv && same(rv, bv)) out.push(lv);
      else out.push(newer(lv, rv));
    } else if (lv) {
      // Missing from the cloud: deleted there, unless it's new here or edited here since.
      if (!bv || !same(lv, bv)) out.push(lv);
    } else if (rv) {
      if (!bv || !same(rv, bv)) out.push(rv);
    }
  }
  return out;
}

/** lastExportAt describes this phone's own file backups, so it never travels. */
function syncedMeta(m: Meta): Meta {
  const { lastExportAt: _ignored, ...rest } = m;
  return rest as Meta;
}

export function mergeMeta(base: Meta | undefined, local: Meta, remote: Meta): Meta {
  const l = syncedMeta(local);
  const r = syncedMeta(remote);
  let merged: Meta;
  if (same(l, r)) merged = l;
  else if (base && same(l, syncedMeta(base))) merged = r;
  else merged = l; // changed here (or both changed): this phone wins
  return local.lastExportAt ? { ...merged, lastExportAt: local.lastExportAt } : merged;
}

/** Remove links to projects or milestones that no longer exist after merging. */
function dropDanglingLinks(d: BackupData): BackupData {
  const projects = new Set(d.projects.map((p) => p.id));
  const milestones = new Set(d.milestones.map((m) => m.id));
  const fix = <T extends { projectId?: string; milestoneId?: string }>(r: T): T => {
    let out = r;
    if (r.projectId && !projects.has(r.projectId)) {
      const { projectId: _p, ...rest } = out;
      out = rest as T;
    }
    if (r.milestoneId && !milestones.has(r.milestoneId)) {
      const { milestoneId: _m, ...rest } = out;
      out = rest as T;
    }
    return out;
  };
  return { ...d, milestones: d.milestones.map(fix), notes: d.notes.map(fix), wins: d.wins.map(fix) };
}

export function mergeData(base: BackupData | undefined, local: BackupData, remote: BackupData): BackupData {
  const out = { meta: mergeMeta(base?.meta, local.meta, remote.meta) } as BackupData;
  for (const k of LIST_KEYS) {
    (out as unknown as Record<string, Rec[]>)[k] = mergeList(
      base?.[k] as Rec[] | undefined,
      (local[k] ?? []) as Rec[],
      (remote[k] ?? []) as Rec[],
    );
  }
  return dropDanglingLinks(out);
}

/** True when two copies hold the same data (ignoring order and this phone's lastExportAt). */
export function sameData(a: BackupData, b: BackupData): boolean {
  if (!same(syncedMeta(a.meta), syncedMeta(b.meta))) return false;
  const sorted = (x: Rec[]) => [...x].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  return LIST_KEYS.every((k) => same(sorted((a[k] ?? []) as Rec[]), sorted((b[k] ?? []) as Rec[])));
}
