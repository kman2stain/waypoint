import type { Note } from '../db/schema';
import { fold, normalizeTag } from './tags';

export interface NoteContext {
  milestoneTitle?: string;
  projectName?: string;
}

/**
 * Every word in the query must match (AND).
 * "#sql" matches the tag exactly; plain words match text, tags, milestone and project.
 */
export function noteMatches(note: Note, query: string, ctx: NoteContext = {}): boolean {
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = fold([note.text, ctx.milestoneTitle ?? '', ctx.projectName ?? ''].join('\n'));
  return tokens.every((t) => {
    if (t.startsWith('#') && t.length > 1) return note.tags.includes(normalizeTag(t));
    const f = fold(t);
    return hay.includes(f) || note.tags.some((tag) => fold(tag).includes(f));
  });
}

/** Tags by how often they're used, most used first (ties alphabetical). */
export function tagCounts(notes: Note[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
