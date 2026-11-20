// Builds a CV line ONLY from the fields the user entered.
// It never calculates (no percentages, no differences), never rounds, never picks
// a direction word like "reduced" or "increased", and never estimates. With no
// numbers it is a plain line; with only one of before/after, the other is left as
// a clearly marked placeholder to fill in by hand.
import type { Win } from '../db/schema';
import { formatMonth, isISODate, parseISODate } from './dates';
import { formatNumber } from './numbers';

export const PLACEHOLDER_BEFORE = '[BEFORE: add number]';
export const PLACEHOLDER_AFTER = '[AFTER: add number]';

export interface CvBullet {
  text: string;
  /** Which placeholders the text contains. */
  missing: ('before' | 'after')[];
}

type WinFields = Pick<Win, 'title' | 'before' | 'after' | 'unit' | 'date' | 'source'>;

export function buildCvBullet(w: WinFields, locale = 'en-GB'): CvBullet {
  const title = w.title.trim().replace(/[\s.;:,]+$/, '');
  const unit = w.unit?.trim();
  const missing: CvBullet['missing'] = [];

  let text: string;
  if (w.before === undefined && w.after === undefined) {
    // No numbers at all: a plain line, nothing to fill in (not every win has a before/after).
    text = title;
  } else {
    const before = w.before !== undefined ? formatNumber(w.before) : (missing.push('before'), PLACEHOLDER_BEFORE);
    const after = w.after !== undefined ? formatNumber(w.after) : (missing.push('after'), PLACEHOLDER_AFTER);
    text = `${title}: from ${before} to ${after}${unit ? ` ${unit}` : ''}`;
  }

  const extras: string[] = [];
  if (w.date && isISODate(w.date)) extras.push(formatMonth(parseISODate(w.date), locale));
  if (w.source?.trim()) extras.push(`confirmed by ${w.source.trim()}`);
  if (extras.length) text += ` (${extras.join('; ')})`;

  return { text: text + '.', missing };
}

export function hasPlaceholders(text: string): boolean {
  return text.includes(PLACEHOLDER_BEFORE) || text.includes(PLACEHOLDER_AFTER);
}
