import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, readAll, type BackupData } from '../src/db/backup';
import { _resetForTests, get, getAll, put, remove } from '../src/db/db';
import type { Note, Win } from '../src/db/schema';
import { ensureSeeded } from '../src/db/seed';
import { decodeBase64, encodeBase64 } from '../src/sync/github';
import { mergeData, mergeList, sameData, stableStringify } from '../src/sync/merge';
import { _setStorageForTests, getStatus, saveConfig, syncNow } from '../src/sync/sync';

const T = (d: number) => `2026-11-${String(d).padStart(2, '0')}T09:00:00.000Z`;
const note = (id: string, text: string, day = 20): Note => ({ id, text, tags: [], createdAt: T(20), updatedAt: T(day) });

describe('mergeList', () => {
  const base = [note('a', 'a'), note('b', 'b'), note('c', 'c')];

  it('keeps one-sided edits, additions and deletions', () => {
    const local = [note('a', 'a edited', 21), note('b', 'b'), note('l', 'new here')];
    const remote = [note('a', 'a'), note('c', 'c'), note('r', 'new in cloud')];
    const out = mergeList(base, local, remote);
    const byId = Object.fromEntries(out.map((n) => [n.id, n.text]));
    // a: edited here; b: deleted in cloud; c: deleted here; l and r: new.
    expect(byId).toEqual({ a: 'a edited', l: 'new here', r: 'new in cloud' });
  });

  it('takes the cloud edit even when updatedAt was not bumped', () => {
    const out = mergeList(base, base, [note('a', 'claude edit'), note('b', 'b'), note('c', 'c')]);
    expect(out.find((n) => n.id === 'a')?.text).toBe('claude edit');
  });

  it('uses the later updatedAt when both sides edited', () => {
    const out = mergeList(base, [note('a', 'phone', 23), note('b', 'b'), note('c', 'c')], [note('a', 'cloud', 22), note('b', 'b'), note('c', 'c')]);
    expect(out.find((n) => n.id === 'a')?.text).toBe('phone');
  });

  it('keeps a record edited on one side and deleted on the other', () => {
    const out = mergeList(base, [note('a', 'a'), note('b', 'b')], [note('a', 'a'), note('b', 'b'), note('c', 'c edited', 22)]);
    expect(out.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('combines both sides on the first sync', () => {
    const out = mergeList(undefined, [note('a', 'a')], [note('b', 'b')]);
    expect(out.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('compares records regardless of key order', () => {
    expect(stableStringify({ b: 1, a: [1, { y: 2, x: 1 }] })).toBe(stableStringify({ a: [1, { x: 1, y: 2 }], b: 1 }));
  });
});

describe('mergeData', () => {
  it('drops links to a project deleted on the other side', async () => {
    await ensureSeeded(new Date(T(20)));
    const base = await readAll();
    base.projects = [{ id: 'p1', name: 'P', archived: false, createdAt: T(20), updatedAt: T(20) }];
    const local: BackupData = { ...base, notes: [{ ...note('n', 'x', 21), projectId: 'p1' }] };
    const remote: BackupData = { ...base, projects: [] };
    const out = mergeData(base, local, remote);
    expect(out.projects).toEqual([]);
    expect(out.notes[0].projectId).toBeUndefined();
    await _resetForTests();
  });

  it('never syncs lastExportAt', async () => {
    await ensureSeeded(new Date(T(20)));
    const d = await readAll();
    const a = { ...d, meta: { ...d.meta, lastExportAt: T(21) } };
    expect(sameData(a, d)).toBe(true);
    expect(mergeData(d, a, d).meta.lastExportAt).toBe(T(21));
    await _resetForTests();
  });
});

it('round-trips unicode through base64', () => {
  const s = 'Months 1–6 · “quotes” · සිංහල';
  expect(decodeBase64(encodeBase64(s))).toBe(s);
});

// ---------------------------------------------------------------- full sync against a fake GitHub

interface FakeRepo {
  text: string | null;
  sha: number;
  puts: number;
}

function fakeGitHub(repo: FakeRepo) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (!url.includes('/contents/')) return json(200, { private: true });
    if (!init?.method || init.method === 'GET') {
      if (repo.text === null) return json(404, { message: 'Not Found' });
      return json(200, { type: 'file', sha: `s${repo.sha}`, encoding: 'base64', content: encodeBase64(repo.text) });
    }
    const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
    if (repo.text !== null && body.sha !== `s${repo.sha}`) return json(409, { message: 'conflict' });
    repo.text = decodeBase64(body.content);
    repo.sha++;
    repo.puts++;
    return json(200, { content: { sha: `s${repo.sha}` } });
  });
}

describe('syncNow', () => {
  let repo: FakeRepo;
  beforeEach(async () => {
    _setStorageForTests();
    repo = { text: null, sha: 1, puts: 0 };
    vi.stubGlobal('fetch', fakeGitHub(repo));
    await ensureSeeded(new Date(T(20)));
    saveConfig({ repo: 'me/waypoint-data', path: 'waypoint.json', token: 't' });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await _resetForTests();
  });

  it('creates the cloud file on first sync', async () => {
    await syncNow('test');
    expect(getStatus()).toMatchObject({ state: 'idle' });
    expect(repo.puts).toBe(1);
    const file = JSON.parse(repo.text!);
    expect(file.app).toBe('waypoint');
    expect(file.data.milestones.length).toBe((await getAll('milestones')).length);
  });

  it('brings cloud edits to the phone and phone edits to the cloud', async () => {
    await syncNow('test');
    // An assistant edits the cloud file: adds a win.
    const file = JSON.parse(repo.text!);
    const win: Win = { id: 'w-cloud', title: 'From the cloud', createdAt: T(22), updatedAt: T(22) };
    file.data.wins.push(win);
    repo.text = JSON.stringify(file);
    repo.sha++;
    // Meanwhile the phone adds a note.
    await put('notes', note('n-phone', 'from the phone', 22));

    await syncNow('test');
    expect(getStatus().state).toBe('idle');
    expect(await get<Win>('wins', 'w-cloud')).toMatchObject({ title: 'From the cloud' });
    const cloud = JSON.parse(repo.text!);
    expect(cloud.data.notes.map((n: Note) => n.id)).toContain('n-phone');
    expect(cloud.data.wins.map((w: Win) => w.id)).toContain('w-cloud');
  });

  it('sends deletions made on the phone', async () => {
    await put('notes', note('n1', 'x'));
    await syncNow('test');
    await remove('notes', 'n1');
    await syncNow('test');
    expect(JSON.parse(repo.text!).data.notes).toEqual([]);
  });

  it('changes nothing when the cloud file is invalid', async () => {
    await syncNow('test');
    repo.text = '{"app":"waypoint","schemaVersion":1,"exportedAt":"bad","data":{}}';
    repo.sha++;
    const before = await createBackup('x', new Date(T(25)));
    await syncNow('test');
    expect(getStatus().state).toBe('error');
    expect(getStatus().error).toMatch(/cloud file has problems/);
    const after = await createBackup('x', new Date(T(25)));
    expect(after).toEqual(before);
  });

  it('reports a rejected token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await syncNow('test');
    expect(getStatus()).toMatchObject({ state: 'error' });
    expect(getStatus().error).toMatch(/token/);
  });
});
