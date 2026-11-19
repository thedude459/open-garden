import { describe, expect, it } from 'vitest';
import { assertDatePair, isIsoDate, plannedOrPlanted } from './dates';

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

describe('plannedOrPlanted (ADR 0040)', () => {
  it('takes a planted date more than a day ahead as the plan', () => {
    expect(plannedOrPlanted(undefined, '2026-12-01', '2026-11-19')).toEqual({
      plannedOn: '2026-12-01',
      plantedOn: null,
    });
  });

  it('keeps today, tomorrow (a time zone ahead of UTC), and past days as planted', () => {
    for (const day of ['2026-11-18', '2026-11-19', '2026-11-20']) {
      expect(plannedOrPlanted('2026-11-01', day, '2026-11-19')).toEqual({
        plannedOn: '2026-11-01',
        plantedOn: day,
      });
    }
    expect(plannedOrPlanted(undefined, undefined, '2026-11-19')).toEqual({
      plannedOn: undefined,
      plantedOn: undefined,
    });
  });

  it('rejects a planned date that is not YYYY-MM-DD', () => {
    expect(() => plannedOrPlanted('2026-02-30', null, '2026-11-19')).toThrow(/YYYY-MM-DD/);
  });
});
