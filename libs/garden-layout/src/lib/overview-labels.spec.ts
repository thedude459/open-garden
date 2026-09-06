import { describe, expect, it } from 'vitest';
import type { LayoutPlantingDto } from '@open-garden/shared-types';
import { overviewPlantingLabels } from './overview-labels';

function planting(name: string, bedId: string, id: string): LayoutPlantingDto {
  return {
    id,
    plantId: 'plant',
    commonName: name,
    species: 'sp',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    bedId,
    spacingInches: 12,
    startMethod: 'direct_seed',
    indoorStartedOn: null,
    placement: { plantingId: id, bedId, xInches: 10, yInches: 10 },
  };
}

describe('overviewPlantingLabels', () => {
  it('aggregates names and counts per occupied bed and ignores unplaced', () => {
    const labels = overviewPlantingLabels([
      planting('Tomato', 'east', 'a'),
      planting('Tomato', 'east', 'b'),
      planting('Basil', 'east', 'c'),
      planting('Pea', 'west', 'd'),
      {
        ...planting('Tray', 'east', 'e'),
        bedId: null,
        placement: null,
        startMethod: 'transplant',
        indoorStartedOn: '2026-08-01',
      },
    ]);
    const east = labels.find((l) => l.bedId === 'east');
    expect(east?.names).toEqual([
      { name: 'Tomato', count: 2 },
      { name: 'Basil', count: 1 },
    ]);
    expect(labels.find((l) => l.bedId === 'west')?.names).toEqual([{ name: 'Pea', count: 1 }]);
  });
});
