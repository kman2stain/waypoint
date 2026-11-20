import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { _resetForTests, getAll, get, put } from '../src/db/db';
import { buildSeed, ensureSeeded } from '../src/db/seed';
import type { Meta, Milestone, Phase } from '../src/db/schema';

afterEach(() => _resetForTests());

describe('seed', () => {
  it('has four phases and two decision gates', () => {
    const { phases, milestones } = buildSeed('2026-11-20T00:00:00.000Z');
    expect(phases.map((p) => p.title)).toEqual(['This month', 'Months 1–6', 'Months 6–18', 'Months 18–30']);
    const gates = milestones.filter((m) => m.kind === 'gate');
    expect(gates.map((g) => g.gateMonth)).toEqual([12, 24]);
    expect(milestones.every((m) => m.status === 'not_started' && m.evidence.length === 0)).toBe(true);
    expect(new Set(milestones.map((m) => m.id)).size).toBe(milestones.length);
  });

  it('uses "my employer" and contains no digits that look like results', () => {
    const { milestones } = buildSeed('2026-11-20T00:00:00.000Z');
    const text = milestones.map((m) => m.title).join('\n');
    expect(text).toContain('my employer');
    // Only allowed numbers: PL-300 and the "~5–6 hours" study target.
    const numbers = text.match(/\d+/g) ?? [];
    expect(new Set(numbers)).toEqual(new Set(['300', '5', '6']));
  });

  it('seeds once and never overwrites existing data', async () => {
    expect(await ensureSeeded()).toBe(true);
    const ms = await getAll<Milestone>('milestones');
    const edited = { ...ms[0], status: 'done' as const };
    await put('milestones', edited);

    expect(await ensureSeeded()).toBe(false);
    expect((await get<Milestone>('milestones', edited.id))?.status).toBe('done');
    expect((await getAll<Phase>('phases')).length).toBe(4);
    expect((await get<Meta>('meta', 'meta'))?.schemaVersion).toBe(1);
  });

  it('concurrent first runs seed exactly once', async () => {
    const results = await Promise.all([ensureSeeded(), ensureSeeded()]);
    expect(results.filter(Boolean).length).toBe(1);
    expect((await getAll<Phase>('phases')).length).toBe(4);
  });
});
