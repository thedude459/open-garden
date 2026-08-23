import { describe, expect, it } from 'vitest';
import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { applyPlantingDrop } from './drop';

const east: LayoutBedDto = {
  id: 'east',
  name: 'East',
  geometry: {
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
};

const west: LayoutBedDto = {
  id: 'west',
  name: 'West',
  geometry: {
    originXInches: 40,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
};

function planting(overrides: Partial<LayoutPlantingDto> = {}): LayoutPlantingDto {
  return {
    id: 'p1',
    plantId: 'plant',
    commonName: 'Tomato',
    species: 'Solanum',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    bedId: 'east',
    spacingInches: 24,
    startMethod: 'direct_seed',
    indoorStartedOn: null,
    placement: { plantingId: 'p1', bedId: 'east', xInches: 20, yInches: 20 },
    ...overrides,
  };
}

describe('applyPlantingDrop', () => {
  it('places onto a sized bed in local inches and sets bedId', () => {
    const before = planting({ placement: null, bedId: null });
    const next = applyPlantingDrop([before], [east], 'p1', before, {
      kind: 'bed',
      bedId: 'east',
      planX: 24,
      planY: 12,
    });
    expect(next[0]?.bedId).toBe('east');
    expect(next[0]?.placement).toEqual({
      plantingId: 'p1',
      bedId: 'east',
      xInches: 24,
      yInches: 12,
    });
  });

  it('reverts to the prior draft when dropped on empty space', () => {
    const before = planting();
    const next = applyPlantingDrop(
      [{ ...before, placement: { plantingId: 'p1', bedId: 'east', xInches: 1, yInches: 1 } }],
      [east],
      'p1',
      before,
      { kind: 'empty' },
    );
    expect(next[0]).toEqual(before);
  });

  it('restores a transplant on tray drop and keeps direct seed in place', () => {
    const transplant = planting({ startMethod: 'transplant', indoorStartedOn: '2026-08-01' });
    const restored = applyPlantingDrop([transplant], [east], 'p1', transplant, { kind: 'tray' });
    expect(restored[0]?.placement).toBeNull();
    expect(restored[0]?.bedId).toBeNull();

    const seed = planting();
    const kept = applyPlantingDrop([seed], [east], 'p1', seed, { kind: 'tray' });
    expect(kept[0]).toEqual(seed);
  });

  it('uses the selected bed when it contains the drop point', () => {
    const before = planting({ placement: null, bedId: null });
    const next = applyPlantingDrop([before], [east, west], 'p1', before, {
      kind: 'bed',
      bedId: 'west',
      planX: 50,
      planY: 10,
    }, 'east');
    expect(next[0]?.bedId).toBe('east');
  });

  it('uses the topmost bed when the selected bed does not contain the point', () => {
    const before = planting({ placement: null, bedId: null });
    const next = applyPlantingDrop([before], [east, west], 'p1', before, {
      kind: 'bed',
      bedId: 'west',
      planX: 120,
      planY: 10,
    }, 'east');
    expect(next[0]?.bedId).toBe('west');
  });

  it('reverts when the target bed has no geometry', () => {
    const before = planting({ placement: null, bedId: null });
    const unsized: LayoutBedDto = { id: 'east', name: 'East', geometry: null };
    const next = applyPlantingDrop([before], [unsized], 'p1', before, {
      kind: 'bed',
      bedId: 'east',
      planX: 10,
      planY: 10,
    });
    expect(next[0]).toEqual(before);
  });
});
