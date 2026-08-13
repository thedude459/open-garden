import { describe, expect, it } from 'vitest';
import { matchesPlantType, matchesZone } from './catalog-service';

describe('catalog filters', () => {
  it('includes zone inside range', () => {
    expect(matchesZone(4, 10, 7)).toBe(true);
    expect(matchesZone(4, 10, 3)).toBe(false);
  });

  it('matches plant type exactly', () => {
    expect(matchesPlantType('vegetable', 'vegetable')).toBe(true);
    expect(matchesPlantType('herb', 'vegetable')).toBe(false);
  });
});
