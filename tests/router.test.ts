import { describe, expect, it } from 'vitest';
import { href, hrefFromProject, originProject, parseHash } from '../src/router';

describe('parseHash', () => {
  it('defaults to roadmap', () => {
    expect(parseHash('')).toEqual({ tab: 'roadmap', params: [] });
    expect(parseHash('#/')).toEqual({ tab: 'roadmap', params: [] });
  });

  it('reads tab and params', () => {
    expect(parseHash('#/notes')).toEqual({ tab: 'notes', params: [] });
    expect(parseHash('#/roadmap/milestone/abc')).toEqual({ tab: 'roadmap', params: ['milestone', 'abc'] });
  });

  it('falls back on unknown tabs and bad encoding', () => {
    expect(parseHash('#/nope')).toEqual({ tab: 'roadmap', params: [] });
    expect(parseHash('#/notes/%E0%A4%A')).toEqual({ tab: 'notes', params: ['%E0%A4%A'] });
  });

  it('remembers the project an item was opened from', () => {
    for (const tab of ['roadmap', 'notes', 'wins'] as const) {
      const route = parseHash(hrefFromProject(tab, 'item', 'proj'));
      expect(route.tab).toBe(tab);
      expect(originProject(route)).toBe('proj');
    }
    expect(originProject(parseHash(href('notes', 'n', 'item')))).toBeUndefined();
    expect(originProject(parseHash(href('notes', 'new', 'item', 'project', 'proj')))).toBeUndefined();
  });

  it('round-trips through href', () => {
    expect(parseHash(href('wins', 'edit', 'a b/c'))).toEqual({ tab: 'wins', params: ['edit', 'a b/c'] });
  });
});
