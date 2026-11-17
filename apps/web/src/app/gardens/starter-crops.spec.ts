import type { PlantSummaryDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { starterCrops } from './starter-crops';

const plant = (cropId: string, over: Partial<PlantSummaryDto> = {}): PlantSummaryDto => ({
  id: cropId,
  commonName: cropId,
  species: cropId,
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 3,
  zoneMax: 10,
  spacingInches: 12,
  illustrationUrl: null,
  cropId,
  ...over,
});

describe('starterCrops', () => {
  const catalog = [
    plant('radish'),
    plant('tomato'),
    plant('tomato', { id: 'tomato-cherry', cultivar: 'Cherry' }),
    plant('okra'),
    plant('lettuce', { zoneMin: 2, zoneMax: 6 }),
    plant('custom', { cropId: null }),
  ];

  it('keeps easy crops that grow in the zone, in the order of the list', () => {
    expect(starterCrops(catalog, 8, new Set()).map((p) => p.id)).toEqual(['tomato', 'radish']);
    expect(starterCrops(catalog, null, new Set()).map((p) => p.id)).toEqual([
      'tomato',
      'lettuce',
      'radish',
    ]);
  });

  it('puts crops that can be sown this week first, and stops at the limit', () => {
    expect(starterCrops(catalog, 5, new Set(['radish'])).map((p) => p.id)).toEqual([
      'radish',
      'tomato',
      'lettuce',
    ]);
    expect(starterCrops(catalog, 5, new Set(), 1)).toHaveLength(1);
  });

  it('lists a crop once, should the catalog hold two entries for it', () => {
    const twice = [plant('tomato'), plant('tomato', { id: 'tomato-2' })];
    expect(starterCrops(twice, 8, new Set()).map((p) => p.id)).toEqual(['tomato']);
  });
});
