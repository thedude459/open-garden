import type { LayoutFlagDto } from '@open-garden/shared-types';
import { centerDistance, pairRequiredSpacing, placementFits } from './spacing';

export type EvaluateBed = {
  id: string;
  geometry: {
    lengthInches: number;
    widthInches: number;
  } | null;
};

export type EvaluatePlanting = {
  id: string;
  spacingInches: number | null;
  placement: { bedId: string; xInches: number; yInches: number } | null;
};

/** The layout as last saved, evaluated with today's catalog spacing. */
export type SavedLayout = { beds: EvaluateBed[]; plantings: EvaluatePlanting[] };

/**
 * Spacing and fit problems. A catalog update can widen a plant's spacing
 * after it was placed. With `saved`, a problem the saved layout already had
 * does not block, as long as none of its plantings moved and their bed kept
 * its size: it is flagged "closer than recommended" instead. New placements
 * follow the current values.
 */
export function evaluateLayout(
  beds: EvaluateBed[],
  plantings: EvaluatePlanting[],
  saved?: SavedLayout,
): LayoutFlagDto[] {
  const flags = layoutProblems(beds, plantings);
  if (!saved) return flags;
  const before = new Set(layoutProblems(saved.beds, saved.plantings).map(flagKey));
  const savedPlantings = new Map(saved.plantings.map((p) => [p.id, p]));
  const savedBeds = new Map(saved.beds.map((b) => [b.id, b]));
  const bedById = new Map(beds.map((b) => [b.id, b]));
  const unchanged = (plantingId: string) => {
    const now = plantings.find((p) => p.id === plantingId)?.placement;
    const then = savedPlantings.get(plantingId)?.placement;
    if (!now || !then) return false;
    if (now.bedId !== then.bedId || now.xInches !== then.xInches || now.yInches !== then.yInches) {
      return false;
    }
    const bed = bedById.get(now.bedId)?.geometry;
    const savedBed = savedBeds.get(now.bedId)?.geometry;
    return (
      bed?.lengthInches === savedBed?.lengthInches && bed?.widthInches === savedBed?.widthInches
    );
  };
  return flags.map((flag) =>
    flag.blocking && before.has(flagKey(flag)) && flag.plantingIds.every(unchanged)
      ? { ...flag, blocking: false, message: GRANDFATHERED[flag.kind] }
      : flag,
  );
}

const GRANDFATHERED: Partial<Record<LayoutFlagDto['kind'], string>> = {
  spacing: 'Closer than recommended',
  fit: 'Closer to the bed edge than recommended',
};

function flagKey(flag: LayoutFlagDto): string {
  return `${flag.kind}:${[...flag.plantingIds].sort().join(',')}`;
}

function layoutProblems(beds: EvaluateBed[], plantings: EvaluatePlanting[]): LayoutFlagDto[] {
  const flags: LayoutFlagDto[] = [];
  const bedById = new Map(beds.map((b) => [b.id, b]));
  const placed = plantings.filter((p) => p.placement);

  for (const planting of placed) {
    const placement = planting.placement!;
    if (planting.spacingInches === null) {
      flags.push({ kind: 'unavailable', plantingIds: [planting.id], blocking: false });
      continue;
    }
    const bed = bedById.get(placement.bedId);
    if (!bed?.geometry) {
      flags.push({ kind: 'fit', plantingIds: [planting.id], blocking: true });
      continue;
    }
    if (
      !placementFits(
        placement.xInches,
        placement.yInches,
        bed.geometry.lengthInches,
        bed.geometry.widthInches,
        planting.spacingInches,
      )
    ) {
      flags.push({ kind: 'fit', plantingIds: [planting.id], blocking: true });
    }
  }

  const byBed = new Map<string, EvaluatePlanting[]>();
  for (const planting of placed) {
    const bedId = planting.placement!.bedId;
    const list = byBed.get(bedId) ?? [];
    list.push(planting);
    byBed.set(bedId, list);
  }

  for (const group of byBed.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const required = pairRequiredSpacing(a.spacingInches, b.spacingInches);
        if (required === null) continue;
        const dist = centerDistance(
          a.placement!.xInches,
          a.placement!.yInches,
          b.placement!.xInches,
          b.placement!.yInches,
        );
        if (dist < required) {
          flags.push({
            kind: 'spacing',
            plantingIds: [a.id, b.id],
            blocking: true,
          });
        }
      }
    }
  }

  return flags;
}
