import { describe, expect, it } from 'vitest';
import { addMonths, isISODate, monthsSince, toISODate } from '../src/lib/dates';

describe('dates', () => {
  it('validates ISO dates strictly', () => {
    expect(isISODate('2026-11-20')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-1-5')).toBe(false);
    expect(isISODate(20261120)).toBe(false);
  });

  it('adds months with day clamping', () => {
    expect(toISODate(addMonths('2026-01-31', 1))).toBe('2026-02-28');
    expect(toISODate(addMonths('2026-11-20', 12))).toBe('2027-11-20');
    expect(toISODate(addMonths('2026-11-20', 0))).toBe('2026-11-20');
  });

  it('counts whole months since a start date', () => {
    expect(monthsSince('2026-11-20', new Date(2026, 10, 25))).toBe(0);
    expect(monthsSince('2026-11-20', new Date(2026, 11, 19))).toBe(0);
    expect(monthsSince('2026-11-20', new Date(2026, 11, 20))).toBe(1);
    expect(monthsSince('2026-11-20', new Date(2027, 10, 20))).toBe(12);
  });
});
