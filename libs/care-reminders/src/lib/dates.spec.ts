import { describe, expect, it } from 'vitest';
import { addIsoDateDays, diffIsoDateDays, isIsoDate } from './dates';

describe('dates', () => {
  it('validates ISO calendar dates', () => {
    expect(isIsoDate('2026-08-17')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('08-17-2026')).toBe(false);
  });

  it('adds days without DST shift', () => {
    expect(addIsoDateDays('2026-01-01', 7)).toBe('2026-01-08');
    expect(addIsoDateDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('diffs calendar days', () => {
    expect(diffIsoDateDays('2026-01-01', '2026-01-08')).toBe(7);
    expect(diffIsoDateDays('2026-02-05', '2026-01-01')).toBe(-35);
  });
});
