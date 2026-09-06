import { describe, expect, it } from 'vitest';
import { plantingFootprintRadius } from './footprint';

describe('plantingFootprintRadius', () => {
  it('uses ceil(s / 2) for known spacing', () => {
    expect(plantingFootprintRadius(5)).toBe(3);
    expect(plantingFootprintRadius(24)).toBe(12);
    expect(plantingFootprintRadius(1)).toBe(1);
  });

  it('uses 6 inches when spacing is unknown', () => {
    expect(plantingFootprintRadius(null)).toBe(6);
  });
});
