import { describe, expect, it } from 'vitest';
import { nextOpenYear, plantAgainRows, plantingIsCurrent, survivesSeasonClose } from './year-record';

describe('year record', () => {
  it('keeps trees and hides last year’s annuals once a season is open', () => {
    expect(plantingIsCurrent('annual', 2025, 2026)).toBe(false);
    expect(plantingIsCurrent('annual', 2026, 2026)).toBe(true);
    expect(plantingIsCurrent('tree', 2020, 2026)).toBe(true);
    expect(plantingIsCurrent('perennial', 2024, 2026)).toBe(true);
    expect(plantingIsCurrent('annual', 2024, null)).toBe(true);
  });

  it('closes this year and opens the next', () => {
    expect(nextOpenYear(2026)).toEqual({ closedYear: 2026, openYear: 2027 });
    expect(survivesSeasonClose('tree')).toBe(true);
    expect(survivesSeasonClose('annual')).toBe(false);
  });

  it('offers each annual once per bed', () => {
    const rows = plantAgainRows([
      { plantId: 'tomato', bedId: 'east', life: 'annual' as const, commonName: 'Tomato' },
      { plantId: 'tomato', bedId: 'east', life: 'annual' as const, commonName: 'Tomato' },
      { plantId: 'apple', bedId: 'orchard', life: 'tree' as const, commonName: 'Apple' },
      { plantId: 'basil', bedId: null, life: 'annual' as const, commonName: 'Basil' },
    ]);
    expect(rows).toEqual([
      { plantId: 'tomato', bedId: 'east', life: 'annual', commonName: 'Tomato' },
    ]);
  });
});
