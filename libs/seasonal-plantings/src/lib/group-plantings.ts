import type { NamedBedDto, PlantingDto } from '@open-garden/shared-types';

export interface PlantingGroup<T extends PlantingDto = PlantingDto> {
  key: string;
  title: string;
  bedId: string | null;
  plantings: T[];
}

function newestFirst<T extends PlantingDto>(a: T, b: T): number {
  const byCreated = b.createdAt.localeCompare(a.createdAt);
  if (byCreated !== 0) return byCreated;
  return b.id.localeCompare(a.id);
}

export function groupPlantings<T extends PlantingDto>(
  plantings: T[],
  beds: NamedBedDto[],
): PlantingGroup<T>[] {
  const groups: PlantingGroup<T>[] = [...beds]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((bed) => ({
      key: bed.id,
      title: bed.name,
      bedId: bed.id,
      plantings: [],
    }));
  const unassigned: T[] = [];
  for (const planting of plantings) {
    if (!planting.bedId) {
      unassigned.push(planting);
      continue;
    }
    const group = groups.find((g) => g.bedId === planting.bedId);
    if (group) group.plantings.push(planting);
    else unassigned.push(planting);
  }
  for (const group of groups) {
    group.plantings.sort(newestFirst);
  }
  unassigned.sort(newestFirst);
  if (unassigned.length > 0) {
    groups.push({
      key: 'unassigned',
      title: 'Unassigned',
      bedId: null,
      plantings: unassigned,
    });
  }
  return groups;
}
