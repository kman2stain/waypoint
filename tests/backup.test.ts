import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, markExported, parseBackup, restoreBackup, summarize, validateBackup } from '../src/db/backup';
import { _resetForTests, get, getAll, put } from '../src/db/db';
import { ensureSeeded } from '../src/db/seed';
import type { Meta, Milestone } from '../src/db/schema';

afterEach(() => _resetForTests());

async function seededBackup() {
  await ensureSeeded(new Date('2026-11-20T09:00:00Z'));
  return createBackup('0.3.0', new Date('2026-11-21T10:00:00Z'));
}

describe('backup round trip', () => {
  it('exports, validates and restores to the same data', async () => {
    const backup = await seededBackup();
    const text = JSON.stringify(backup);
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(summarize(parsed.backup.data)).toMatchObject({ phases: 4, milestones: 24, evidence: 0 });

    // Change something, then restore: the change must be gone.
    const ms = await getAll<Milestone>('milestones');
    await put('milestones', { ...ms[0], status: 'done' });
    await put('notes', { id: 'n1', text: 'x', tags: [], createdAt: backup.exportedAt, updatedAt: backup.exportedAt });

    await restoreBackup(parsed.backup);
    expect((await get<Milestone>('milestones', ms[0].id))?.status).toBe('not_started');
    expect(await getAll('notes')).toEqual([]);
    expect((await get<Meta>('meta', 'meta'))?.lastExportAt).toBe('2026-11-21T10:00:00.000Z');
  });

  it('records the last export time', async () => {
    await ensureSeeded();
    await markExported(new Date('2026-12-01T08:00:00Z'));
    expect((await get<Meta>('meta', 'meta'))?.lastExportAt).toBe('2026-12-01T08:00:00.000Z');
  });
});

describe('backup validation', () => {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

  it('rejects files that are not Waypoint backups', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(validateBackup({ hello: 1 }).ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
  });

  it('rejects backups from a newer app version', async () => {
    const b = clone(await seededBackup());
    b.schemaVersion = 99;
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/newer version/);
  });

  it('reports bad fields with a readable path', async () => {
    const b = clone(await seededBackup()) as any;
    b.data.milestones[2].status = 'finished';
    b.data.milestones[3].targetDate = '31/12/2026';
    b.data.milestones[4].evidence = [{ id: 'e1', text: '' }];
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('data.milestones[2].status: must be one of: not_started, in_progress, done');
    expect(r.errors).toContain('data.milestones[3].targetDate: must be a date like 2026-01-31');
    expect(r.errors).toContain('data.milestones[4].evidence[0].text: must not be empty');
  });

  it('rejects duplicate ids and dangling references', async () => {
    const b = clone(await seededBackup()) as any;
    b.data.milestones[1].id = b.data.milestones[0].id;
    let r = validateBackup(b);
    expect(r.ok).toBe(false);

    const b2 = clone(await seededBackup()) as any;
    b2.data.milestones[0].phaseId = 'nope';
    r = validateBackup(b2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/phase that is not in the backup/);
  });

  it('rejects win numbers stored as text (never guesses a number)', async () => {
    const b = clone(await seededBackup()) as any;
    b.data.wins = [{ id: 'w1', title: 'Faster report', before: '40', createdAt: b.exportedAt, updatedAt: b.exportedAt }];
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('data.wins[0].before: must be a number');
  });

  it('accepts older backups that lack newer lists', async () => {
    const b = clone(await seededBackup()) as any;
    delete b.data.decisions;
    delete b.data.studyLogs;
    const r = validateBackup(b);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.decisions).toEqual([]);
  });
});
