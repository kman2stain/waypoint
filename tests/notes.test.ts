import { describe, expect, it } from 'vitest';
import type { Note } from '../src/db/schema';
import { noteMatches, tagCounts } from '../src/lib/search';
import { extractHashtags, normalizeTag, uniqueTags } from '../src/lib/tags';

const note = (text: string, tags: string[] = []): Note => ({
  id: text,
  text,
  tags,
  createdAt: '2026-11-20T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
});

describe('tags', () => {
  it('normalizes', () => {
    expect(normalizeTag('  #SQL ')).toBe('sql');
    expect(normalizeTag('Power BI')).toBe('power-bi');
    expect(normalizeTag('#')).toBe('');
    expect(uniqueTags(['SQL', 'sql', '#Sql', ''])).toEqual(['sql']);
  });

  it('extracts hashtags but not mid-word # or headings', () => {
    expect(extractHashtags('Did #SQL joins, then #pl-300 mock (#dax)')).toEqual(['sql', 'pl-300', 'dax']);
    expect(extractHashtags('C# and issue#12 are not tags')).toEqual([]);
    expect(extractHashtags('# heading and #  spaced')).toEqual([]);
    expect(extractHashtags('Café #résumé')).toEqual(['résumé']);
  });
});

describe('note search', () => {
  const sql = note('Practised window functions', ['sql']);
  const dax = note('Explained CALCULATE to my manager', ['dax', 'pl-300']);
  const cv = note('Update résumé with dashboard case study');

  it('matches words anywhere, all words required, accent-insensitive', () => {
    expect(noteMatches(sql, 'window')).toBe(true);
    expect(noteMatches(sql, 'WINDOW functions')).toBe(true);
    expect(noteMatches(sql, 'window dax')).toBe(false);
    expect(noteMatches(cv, 'resume')).toBe(true);
  });

  it('#tag matches tags exactly, plain words also search tags', () => {
    expect(noteMatches(dax, '#pl-300')).toBe(true);
    expect(noteMatches(dax, '#pl')).toBe(false);
    expect(noteMatches(dax, 'pl-3')).toBe(true);
  });

  it('searches the linked milestone and project names', () => {
    expect(noteMatches(sql, 'dataverse', { milestoneTitle: 'Rebuild an app on Dataverse' })).toBe(true);
    expect(noteMatches(sql, 'pr app', { projectName: 'PR app' })).toBe(true);
  });

  it('empty query matches everything', () => {
    expect(noteMatches(sql, '   ')).toBe(true);
  });

  it('counts tags, most used first', () => {
    expect(tagCounts([sql, dax, note('x', ['sql'])])).toEqual([
      ['sql', 2],
      ['dax', 1],
      ['pl-300', 1],
    ]);
  });
});
