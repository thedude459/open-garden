import type { CatalogCompanionDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { rankCompanions, zoneDistance } from './rank-companions';

const pair = (
  name: string,
  zones: Array<{ min: number; max: number } | null>,
  evidence: CatalogCompanionDto['evidence'] = 'research',
): CatalogCompanionDto => ({
  cropId: name.toLowerCase(),
  name,
  kind: 'helps',
  benefits: ['deters-pests'],
  evidence,
  reason: 'x',
  reference: null,
  shownIn: zones.map((z) => ({ where: 'Somewhere', zones: z })),
});

describe('zoneDistance', () => {
  it('is 0 inside a range and counts zones outside it', () => {
    const iowa = pair('Nasturtium', [{ min: 5, max: 5 }]);
    expect(zoneDistance(iowa, [5])).toBe(0);
    expect(zoneDistance(iowa, [8])).toBe(3);
    expect(zoneDistance(iowa, [3])).toBe(2);
    // The nearest of several properties counts.
    expect(zoneDistance(iowa, [9, 6])).toBe(1);
  });

  it('is infinite for a greenhouse or when no zones are known', () => {
    expect(zoneDistance(pair('Marigold', [null]), [5])).toBe(Number.POSITIVE_INFINITY);
    expect(zoneDistance(pair('Nasturtium', [{ min: 5, max: 5 }]), [])).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('rankCompanions', () => {
  it('puts pairs shown near the zones first, then stronger evidence, then by name', () => {
    const pairs = [
      pair('Basil', [null]),
      pair('Calendula', [{ min: 7, max: 9 }], 'extension'),
      pair('Thyme', [{ min: 5, max: 5 }]),
      pair('Onion', [{ min: 5, max: 5 }]),
      pair('Dill', [{ min: 7, max: 9 }], 'research'),
    ];
    expect(rankCompanions(pairs, [8]).map((p) => p.name)).toEqual([
      'Dill',
      'Calendula',
      'Onion',
      'Thyme',
      'Basil',
    ]);
    // Without zones: evidence, then name; nothing is dropped.
    expect(rankCompanions(pairs, []).map((p) => p.name)).toEqual([
      'Basil',
      'Dill',
      'Onion',
      'Thyme',
      'Calendula',
    ]);
  });
});
