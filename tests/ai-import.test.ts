// Checks that a file edited the way docs/import-with-ai.md tells an AI to edit it
// passes the app's restore validation, and that the mistakes the prompt warns
// against are really rejected.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, restoreBackup, summarize, validateBackup } from '../src/db/backup';
import { _resetForTests, get, getAll } from '../src/db/db';
import { ensureSeeded } from '../src/db/seed';
import type { Meta, Milestone, Win } from '../src/db/schema';
import { buildCvBullet } from '../src/lib/cvBullet';

afterEach(() => _resetForTests());

const NOW = '2026-11-21T08:00:00.000Z';

async function aiEditedFile() {
  await ensureSeeded(new Date('2026-11-20T09:00:00Z'));
  const b = JSON.parse(JSON.stringify(await createBackup('1.0.0', new Date('2026-11-20T10:00:00Z'))));
  const d = b.data;
  b.exportedAt = NOW;
  d.meta.startDate = '2026-09-01';

  const ms = (id: string) => d.milestones.find((m: Milestone) => m.id === id);
  Object.assign(ms('seed-p1-m1'), {
    status: 'done',
    notes: 'Offer and title confirmed in writing.',
    updatedAt: NOW,
    evidence: [{ id: 'imp-ev-001', text: 'Offer letter received', date: '2026-10-02', confirmedBy: 'HR' }],
  });
  Object.assign(ms('seed-p1-m6'), { status: 'in_progress', updatedAt: NOW });

  d.milestones.push({
    id: 'imp-ms-001',
    phaseId: 'seed-p1',
    order: 7,
    title: 'Present the inventory dashboard to the warehouse team',
    kind: 'task',
    status: 'done',
    notes: '',
    evidence: [{ id: 'imp-ev-002', text: 'Demo held', date: '2026-10-15' }],
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: NOW,
  });
  d.projects.push({ id: 'imp-proj-001', name: 'Inventory dashboard', archived: false, createdAt: '2026-09-10T09:00:00.000Z', updatedAt: NOW });
  d.milestones.find((m: Milestone) => m.id === 'imp-ms-001').projectId = 'imp-proj-001';
  d.notes.push({
    id: 'imp-note-001',
    text: 'Manager asked for a weekly refresh instead of daily.',
    tags: ['power-bi', 'feedback'],
    milestoneId: 'imp-ms-001',
    projectId: 'imp-proj-001',
    createdAt: '2026-10-16T09:00:00.000Z',
    updatedAt: NOW,
  });
  // A win with confirmed numbers, and one where the user gave no numbers.
  d.wins.push(
    {
      id: 'imp-win-001',
      title: 'Automated the weekly stock report',
      before: 6,
      after: 0.5,
      unit: 'hours/week',
      date: '2026-10-20',
      source: 'Ops manager email, 20 Oct',
      projectId: 'imp-proj-001',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: NOW,
    },
    {
      id: 'imp-win-002',
      title: 'Built the PR approval app',
      context: 'Used by the purchasing team; no usage numbers yet.',
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: NOW,
    },
  );
  return b;
}

describe('AI import file (docs/import-with-ai.md)', () => {
  it('validates and restores, with a no-numbers win as a plain line', async () => {
    const file = await aiEditedFile();
    const r = validateBackup(JSON.parse(JSON.stringify(file)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(summarize(r.backup.data)).toMatchObject({ milestones: 25, evidence: 2, notes: 1, wins: 2 });

    await restoreBackup(r.backup);
    expect((await get<Milestone>('milestones', 'seed-p1-m1'))?.status).toBe('done');
    expect((await get<Meta>('meta', 'meta'))?.startDate).toBe('2026-09-01');
    const wins = await getAll<Win>('wins');
    const noNumbers = wins.find((w) => w.id === 'imp-win-002')!;
    expect(buildCvBullet(noNumbers).missing).toEqual([]);
  });

  it('rejects the mistakes the prompt warns about', async () => {
    const check = async (mutate: (b: any) => void) => {
      const b = await aiEditedFile();
      mutate(b);
      await _resetForTests();
      return validateBackup(b).ok;
    };
    expect(await check((b) => (b.data.wins[0].before = '6'))).toBe(false); // number as text
    expect(await check((b) => (b.data.notes[0].projectId = null))).toBe(false); // null
    expect(await check((b) => (b.data.notes[0].milestoneId = 'does-not-exist'))).toBe(false); // broken link
    expect(await check((b) => (b.data.milestones[0].projectId = 'does-not-exist'))).toBe(false); // broken project link
    expect(await check((b) => (b.data.milestones[0].projectId = null))).toBe(false); // null project
    expect(await check((b) => (b.data.milestones[0].status = 'completed'))).toBe(false); // wrong status word
    expect(await check((b) => (b.data.milestones[0].targetDate = '14/03/2026'))).toBe(false); // wrong date format
    expect(await check((b) => b.data.wins.push({ ...b.data.wins[0] }))).toBe(false); // reused id
  });
});
