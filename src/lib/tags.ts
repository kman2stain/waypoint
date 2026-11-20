// Tags are stored lowercase without the leading '#', e.g. "sql", "pl-300".

const HASHTAG = /(^|[\s(,;])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

export function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

/** "#SQL practice with #pl-300" → ["sql", "pl-300"] */
export function extractHashtags(text: string): string[] {
  return uniqueTags([...text.matchAll(HASHTAG)].map((m) => m[2]));
}

/** Lowercase and strip accents so "resume" finds "résumé". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
