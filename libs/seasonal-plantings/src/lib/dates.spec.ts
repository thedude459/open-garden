import { describe, expect, it } from 'vitest';
import { assertDatePair, isIsoDate } from './dates';

describe('assertDatePair', () => {
  it('allows future dates and leaves null unset', () => {
    expect(() => assertDatePair('2099-01-01', '2099-06-01')).not.toThrow();
    expect(() => assertDatePair(null, null)).not.toThrow();
    expect(() => assertDatePair(null, '2026-08-01')).not.toThrow();
    expect(() => assertDatePair('2026-08-01', null)).not.toThrow();
  });

  it('rejects harvest before planted and invalid ISO dates', () => {
    expect(() => assertDatePair('2026-06-02', '2026-06-01')).toThrow(
      /Harvest date must be on or after planted date/,
    );
    expect(() => assertDatePair('2026-13-01', null)).toThrow(/Date must be YYYY-MM-DD/);
    expect(() => assertDatePair(null, '2026-13-01')).toThrow(/Date must be YYYY-MM-DD/);
    expect(isIsoDate('2026-08-16')).toBe(true);
    expect(isIsoDate('not-a-date')).toBe(false);
  });
});
