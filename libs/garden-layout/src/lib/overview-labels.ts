import type { LayoutPlantingDto } from '@open-garden/shared-types';

export interface OverviewLabel {
  bedId: string;
  names: Array<{ name: string; count: number }>;
}

/** Distinct planting names per bed, with a count when a name appears more than once. */
export function overviewPlantingLabels(plantings: LayoutPlantingDto[]): OverviewLabel[] {
  const byBed = new Map<string, Map<string, number>>();
  for (const planting of plantings) {
    const bedId = planting.placement?.bedId ?? planting.bedId;
    if (!bedId || !planting.placement) continue;
    const names = byBed.get(bedId) ?? new Map<string, number>();
    names.set(planting.commonName, (names.get(planting.commonName) ?? 0) + 1);
    byBed.set(bedId, names);
  }
  return [...byBed.entries()].map(([bedId, names]) => ({
    bedId,
    names: [...names.entries()].map(([name, count]) => ({ name, count })),
  }));
}
