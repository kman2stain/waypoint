import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveProject, NEW_PROJECT } from '../src/components/LinkFields';
import { createBackup, restoreBackup, validateBackup } from '../src/db/backup';
import { _resetForTests, get, getAll, put, write } from '../src/db/db';
import type { Milestone, Note, Project, Win } from '../src/db/schema';
import { ensureSeeded } from '../src/db/seed';
import { deleteProjectOps, projectItems } from '../src/lib/projects';

afterEach(() => _resetForTests());

const T = '2026-11-22T09:00:00.000Z';
const base = (id: string) => ({ id, createdAt: T, updatedAt: T });
const project = (id: string): Project => ({ ...base(id), name: id.toUpperCase(), archived: false });
const milestone = (id: string, projectId?: string): Milestone => ({
  ...base(id),
  phaseId: 'seed-p1',
  order: 1,
  title: id,
  kind: 'task',
  status: 'not_started',
  notes: '',
  evidence: [],
  ...(projectId ? { projectId } : {}),
});
const note = (id: string, links: Partial<Note> = {}): Note => ({ ...base(id), text: id, tags: [], ...links });
const win = (id: string, links: Partial<Win> = {}): Win => ({ ...base(id), title: id, ...links });

const all = {
  milestones: [milestone('ma', 'a'), milestone('mb', 'b'), milestone('mx')],
  notes: [
    note('direct', { projectId: 'a' }),
    note('via', { milestoneId: 'ma' }),
    note('own-wins', { milestoneId: 'ma', projectId: 'b' }),
    note('none', { milestoneId: 'mx' }),
  ],
  wins: [win('win-direct', { projectId: 'a' }), win('win-via', { milestoneId: 'ma' }), win('win-none')],
};

describe('projectItems', () => {
  it('includes direct links and items linked through a milestone', () => {
    const a = projectItems('a', all);
    expect(a.milestones.map((r) => r.id)).toEqual(['ma']);
    expect(a.notes.map((r) => r.id)).toEqual(['direct', 'via']);
    expect(a.wins.map((r) => r.id)).toEqual(['win-direct', 'win-via']);
  });

  it("lets an item's own project take priority over its milestone's", () => {
    expect(projectItems('b', all).notes.map((r) => r.id)).toEqual(['own-wins']);
  });
});

describe('deleting a project', () => {
  it('only unlinks, and leaves a backup that still restores', async () => {
    await ensureSeeded(new Date(T));
    await write([
      ...[project('a'), project('b')].map((value) => ({ type: 'put' as const, store: 'projects' as const, value })),
      ...(['milestones', 'notes', 'wins'] as const).flatMap((store) =>
        all[store].map((value) => ({ type: 'put' as const, store, value })),
      ),
    ]);
    await write(deleteProjectOps('a', all, T));

    expect((await getAll<Project>('projects')).map((p) => p.id)).toEqual(['b']);
    expect(await get<Milestone>('milestones', 'ma')).not.toHaveProperty('projectId');
    expect((await get<Milestone>('milestones', 'mb'))?.projectId).toBe('b');
    expect(await getAll('notes')).toHaveLength(all.notes.length);
    expect(await getAll('wins')).toHaveLength(all.wins.length);
    expect(validateBackup(await createBackup('1.1.0')).ok).toBe(true);
  });
});

describe('backups', () => {
  it('still restores a file from before milestones had projects', async () => {
    await ensureSeeded(new Date(T));
    const old = JSON.parse(JSON.stringify(await createBackup('1.0.1')));
    expect(old.data.milestones.some((m: Milestone) => m.projectId)).toBe(false);
    expect(validateBackup(old).ok).toBe(true);
  });

  it("keeps a milestone's project through export and restore", async () => {
    await ensureSeeded(new Date(T));
    await put('projects', project('a'));
    await put('milestones', milestone('ma', 'a'));
    const r = validateBackup(JSON.parse(JSON.stringify(await createBackup('1.1.0'))));
    if (!r.ok) throw new Error(r.errors.join());
    await _resetForTests();
    await restoreBackup(r.backup);
    expect((await get<Milestone>('milestones', 'ma'))?.projectId).toBe('a');
  });
});

describe('resolveProject', () => {
  it('reuses a project with the same name', () => {
    expect(resolveProject(NEW_PROJECT, ' a ', [project('a')], T)).toEqual({ projectId: 'a', ops: [] });
  });
});
