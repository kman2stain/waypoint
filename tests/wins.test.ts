import { describe, expect, it } from 'vitest';
import { buildCvBullet, PLACEHOLDER_AFTER, PLACEHOLDER_BEFORE } from '../src/lib/cvBullet';
import { parseUserNumber } from '../src/lib/numbers';

describe('parseUserNumber', () => {
  it('accepts plain numbers and a decimal point or comma', () => {
    expect(parseUserNumber('40')).toEqual({ kind: 'ok', value: 40 });
    expect(parseUserNumber(' 12.5 ')).toEqual({ kind: 'ok', value: 12.5 });
    expect(parseUserNumber('0,5')).toEqual({ kind: 'ok', value: 0.5 });
    expect(parseUserNumber('-3')).toEqual({ kind: 'ok', value: -3 });
    expect(parseUserNumber('')).toEqual({ kind: 'empty' });
  });

  it('refuses to guess', () => {
    expect(parseUserNumber('1,200').kind).toBe('error'); // 1200 or 1.2?
    expect(parseUserNumber('1.200').kind).toBe('error');
    expect(parseUserNumber('1,25')).toEqual({ kind: 'ok', value: 1.25 });
    expect(parseUserNumber('1200')).toEqual({ kind: 'ok', value: 1200 });
    expect(parseUserNumber('about 40').kind).toBe('error');
    expect(parseUserNumber('40%').kind).toBe('error');
    expect(parseUserNumber('~40').kind).toBe('error');
    expect(parseUserNumber('1.2.3').kind).toBe('error');
    expect(parseUserNumber('40h').kind).toBe('error');
  });
});

describe('buildCvBullet', () => {
  it('uses only the entered fields', () => {
    const b = buildCvBullet({
      title: 'Automated the weekly stock report.',
      before: 6,
      after: 0.5,
      unit: 'hours/week',
      date: '2027-03-15',
      source: 'Ops manager',
    });
    expect(b.text).toBe('Automated the weekly stock report: from 6 to 0.5 hours/week (Mar 2027; confirmed by Ops manager).');
    expect(b.missing).toEqual([]);
  });

  it('leaves clearly marked placeholders for missing numbers', () => {
    const onlyAfter = buildCvBullet({ title: 'Cut invoice errors', after: 3, unit: 'per month' });
    expect(onlyAfter.text).toBe(`Cut invoice errors: from ${PLACEHOLDER_BEFORE} to 3 per month.`);
    expect(onlyAfter.missing).toEqual(['before']);

    const none = buildCvBullet({ title: 'Built the PR approval app' });
    expect(none.text).toBe(`Built the PR approval app: from ${PLACEHOLDER_BEFORE} to ${PLACEHOLDER_AFTER}.`);
    expect(none.missing).toEqual(['before', 'after']);
  });

  it('never calculates, rounds or adds direction words', () => {
    const b = buildCvBullet({ title: 'Report runtime', before: 47.333, after: 12, unit: 'min' });
    expect(b.text).toBe('Report runtime: from 47.333 to 12 min.');
    expect(b.text).not.toMatch(/%|reduc|increas|improv|saved|cut by/i);
  });

  it('only contains digits that came from the user', () => {
    const cases = [
      { title: 'Faster month-end', before: 5, after: 2, unit: 'days', date: '2027-01-10', source: 'Finance lead' },
      { title: 'Fewer manual steps', after: 4 },
      { title: 'Dashboard adoption', before: 0, after: 35, unit: 'weekly users' },
    ];
    for (const c of cases) {
      const allowed = new Set(
        [String(c.title), String(c.before ?? ''), String(c.after ?? ''), c.date?.slice(0, 4) ?? ''].join('').match(/\d/g) ?? [],
      );
      const used = buildCvBullet(c).text.match(/\d/g) ?? [];
      for (const d of used) expect(allowed.has(d)).toBe(true);
    }
  });

  it('keeps zero as a real number', () => {
    expect(buildCvBullet({ title: 'Late shipments', before: 12, after: 0 }).text).toBe('Late shipments: from 12 to 0.');
  });
});
