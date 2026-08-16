import { describe, expect, it } from 'vitest';
import { groupPlantings } from './group-plantings';
import type { NamedBedDto, PlantingDto } from '@open-garden/shared-types';

function planting(partial: Partial<PlantingDto> & { id: string }): PlantingDto {
  return {
    plantId: 'plant-1',
    commonName: 'Tomato',
    species: 'S. lycopersicum',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    plantedOn: null,
    harvestedOn: null,
    bedId: null,
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z',
    ...partial,
  };
}

function bed(id: string, name: string): NamedBedDto {
  return {
    id,
    name,
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z',
  };
}

describe('groupPlantings', () => {
  it('shows empty beds and omits Unassigned when there are no plantings', () => {
    const groups = groupPlantings([], [bed('b1', 'Raised bed 1')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Raised bed 1');
    expect(groups[0]?.plantings).toEqual([]);
    expect(groups.some((g) => g.key === 'unassigned')).toBe(false);
  });

  it('includes Unassigned only when a planting has no bed', () => {
    const assigned = planting({ id: 'p1', bedId: 'b1', createdAt: '2026-08-16T12:00:00.000Z' });
    const loose = planting({ id: 'p2', bedId: null, createdAt: '2026-08-16T11:00:00.000Z' });
    const groups = groupPlantings([assigned, loose], [bed('b1', 'A'), bed('b2', 'Empty')]);
    expect(groups.map((g) => g.title)).toEqual(['A', 'Empty', 'Unassigned']);
    expect(groups[0]?.plantings.map((p) => p.id)).toEqual(['p1']);
    expect(groups[1]?.plantings).toEqual([]);
    expect(groups[2]?.plantings.map((p) => p.id)).toEqual(['p2']);
  });

  it('omits Unassigned when every planting is assigned and sorts newest recorded first', () => {
    const older = planting({ id: 'old', bedId: 'b1', createdAt: '2026-08-01T00:00:00.000Z' });
    const newer = planting({ id: 'new', bedId: 'b1', createdAt: '2026-08-10T00:00:00.000Z' });
    const groups = groupPlantings([older, newer], [bed('b1', 'Bed')]);
    expect(groups.some((g) => g.key === 'unassigned')).toBe(false);
    expect(groups[0]?.plantings.map((p) => p.id)).toEqual(['new', 'old']);
  });

  it('places unknown bed ids in Unassigned and breaks createdAt ties by id', () => {
    const lost = planting({ id: 'z', bedId: 'gone', createdAt: '2026-08-16T10:00:00.000Z' });
    const loose = planting({ id: 'a', bedId: null, createdAt: '2026-08-16T10:00:00.000Z' });
    const groups = groupPlantings([lost, loose], []);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Unassigned');
    expect(groups[0]?.plantings.map((p) => p.id)).toEqual(['z', 'a']);
  });
});
