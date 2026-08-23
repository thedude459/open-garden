import { describe, expect, it } from 'vitest';
import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { catalogDropOutcome } from './catalog-drop';

const bed: LayoutBedDto = {
  id: 'bed-1',
  name: 'East',
  geometry: {
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
};

function planting(id: string, x: number, y: number, spacing: number): LayoutPlantingDto {
  return {
    id,
    plantId: 'p',
    commonName: 'Tomato',
    species: 'Solanum',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    bedId: 'bed-1',
    spacingInches: spacing,
    startMethod: 'direct_seed',
    indoorStartedOn: null,
    placement: { plantingId: id, bedId: 'bed-1', xInches: x, yInches: y },
  };
}

describe('catalogDropOutcome', () => {
  it('returns miss outside the open bed', () => {
    expect(catalogDropOutcome(bed, [], 200, 200, 12)).toBe('miss');
  });

  it('returns ok on a clear spot', () => {
    expect(catalogDropOutcome(bed, [], 48, 24, 12)).toBe('ok');
  });

  it('returns spacing when too close to another plant', () => {
    expect(catalogDropOutcome(bed, [planting('a', 20, 20, 24)], 20, 20, 24)).toBe('spacing');
  });

  it('returns fit when the footprint does not fit', () => {
    expect(catalogDropOutcome(bed, [], 2, 2, 36)).toBe('fit');
  });
});
