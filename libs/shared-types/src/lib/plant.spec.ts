import { describe, expect, it } from 'vitest';
import { plantName } from './plant';

describe('plantName', () => {
  it('adds the variety, so a crop and its variety read differently', () => {
    expect(plantName({ commonName: 'Tomato', cultivar: 'Cherry' })).toBe('Tomato (Cherry)');
    expect(plantName({ commonName: 'Tomato', cultivar: null })).toBe('Tomato');
  });
});
