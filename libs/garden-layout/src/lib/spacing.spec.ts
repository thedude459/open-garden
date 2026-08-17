import { describe, expect, it } from 'vitest';
import { fitClearance, pairRequiredSpacing, placementFits } from './spacing';

describe('spacing helpers', () => {
  it('uses the larger known spacing and skips unknown pairs', () => {
    expect(pairRequiredSpacing(12, 24)).toBe(24);
    expect(pairRequiredSpacing(null, 24)).toBeNull();
  });

  it('uses ceil(s/2) clearance so spacing 5 needs 3 inches from the edge', () => {
    expect(fitClearance(5)).toBe(3);
    expect(fitClearance(24)).toBe(12);
    expect(placementFits(12, 12, 96, 48, 24)).toBe(true);
    expect(placementFits(2, 12, 96, 48, 24)).toBe(false);
    expect(placementFits(12, 12, 20, 20, 24)).toBe(false);
    expect(placementFits(1, 1, 10, 10, null)).toBe(true);
  });
});
