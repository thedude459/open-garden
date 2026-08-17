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

export function evaluateLayout(beds: EvaluateBed[], plantings: EvaluatePlanting[]): LayoutFlagDto[] {
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
