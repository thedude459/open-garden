import { describe, expect, it } from 'vitest';
import { plantName, rootstockSpacing } from './plant';

describe('plantName', () => {
  it('adds the variety, so a crop and its variety read differently', () => {
    expect(plantName({ commonName: 'Tomato', cultivar: 'Cherry' })).toBe('Tomato (Cherry)');
    expect(plantName({ commonName: 'Tomato', cultivar: null })).toBe('Tomato');
  });
});

describe('rootstockSpacing', () => {
  it('is null for a plant without rootstocks', () => {
    expect(rootstockSpacing({})).toBeNull();
    expect(rootstockSpacing({ dwarfSpacingInches: 94, standardSpacingInches: null })).toEqual({
      dwarf: 94,
      semiDwarf: null,
      standard: null,
    });
  });
});
