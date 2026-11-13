import { describe, expect, it } from 'vitest';
import { formatDay, formatMonthDay } from './dates';

describe('dates', () => {
  it('writes a stored day the way the reader’s locale does', () => {
    expect(formatDay('2026-05-01', 'en-US')).toBe('May 1, 2026');
    expect(formatDay('2026-05-01', 'en-GB')).toBe('1 May 2026');
    expect(formatDay('2026-05-01', 'de-DE')).toBe('1. Mai 2026');
  });

  it('never shifts a day with the time zone, and leaves other text alone', () => {
    expect(formatDay('2026-12-31', 'en-US')).toBe('Dec 31, 2026');
    expect(formatDay('2026-01-01', 'en-US')).toBe('Jan 1, 2026');
    expect(formatDay('soon', 'en-US')).toBe('soon');
    expect(formatDay(null)).toBe('');
  });

  it('writes a day of no particular year, including 29 February', () => {
    expect(formatMonthDay({ month: 5, day: 1 }, 'en-US')).toBe('May 1');
    expect(formatMonthDay({ month: 5, day: 1 }, 'fr-FR')).toBe('1 mai');
    expect(formatMonthDay({ month: 2, day: 29 }, 'en-GB')).toBe('29 Feb');
  });
});
