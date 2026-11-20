// Parses a number exactly as typed. It never guesses: anything ambiguous is
// rejected with a message instead of being "interpreted".

export type ParsedNumber = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'error'; message: string };

export function parseUserNumber(raw: string): ParsedNumber {
  const s = raw.trim().replace(/\s+/g, '');
  if (!s) return { kind: 'empty' };
  // "1,200" and "1.200" each mean 1200 in some countries and 1.2 in others: don't guess.
  if (/^-?\d{1,3}[.,]\d{3}$/.test(s)) {
    return { kind: 'error', message: 'Ambiguous: write 1200 or 1.2 (no thousands separator).' };
  }
  if (!/^-?\d+([.,]\d+)?$/.test(s)) {
    return { kind: 'error', message: 'Use digits only, e.g. 40 or 12.5.' };
  }
  const value = Number(s.replace(',', '.'));
  if (!Number.isFinite(value)) return { kind: 'error', message: 'That number is too large.' };
  return { kind: 'ok', value };
}

/** Shows a stored number without rounding or adding separators. */
export function formatNumber(n: number): string {
  return String(n);
}
