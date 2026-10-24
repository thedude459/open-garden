import type { CompanionPairDto, LayoutFlagDto, PriorCropDto } from '@open-garden/shared-types';

export type NoteBed = { id: string; sun?: string | null };
export type NotePlanting = {
  id: string;
  plantId?: string;
  commonName?: string;
  sunRequirements?: string | null;
  spacingInches: number | null;
  spacingFeet?: number | null;
  placement: { bedId: string } | null;
};

export function normalizeSun(value: string | null | undefined): 'full' | 'part' | 'shade' | null {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes('part')) return 'part';
  if (text.includes('shade')) return 'shade';
  if (text.includes('full')) return 'full';
  return null;
}

export function sunDisagrees(bedSun: string | null | undefined, plantSun: string | null | undefined): boolean {
  const bed = normalizeSun(bedSun);
  const plant = normalizeSun(plantSun);
  if (!bed || !plant || bed === 'part' || plant === 'part') return false;
  return bed !== plant;
}

/** Feet win for a tree. Catalog inches stay when feet are unset. */
export function spacingInchesFor(spacingFeet: number | null | undefined, catalogInches: number | null): number | null {
  if (spacingFeet != null && spacingFeet > 0) return Math.round(spacingFeet * 12);
  return catalogInches;
}

export function placementNotes(input: {
  beds: NoteBed[];
  plantings: NotePlanting[];
  priorCrops?: PriorCropDto[];
  pairs?: CompanionPairDto[];
}): LayoutFlagDto[] {
  const flags: LayoutFlagDto[] = [];
  const bedSun = new Map(input.beds.map((bed) => [bed.id, bed.sun ?? null]));
  const names = new Map(
    input.plantings.filter((p) => p.plantId).map((p) => [p.plantId!, p.commonName ?? 'Plant']),
  );
  const placed = input.plantings.filter((p) => p.placement && p.plantId);
  const seenPairs = new Set<string>();

  for (const planting of placed) {
    const bedId = planting.placement!.bedId;
    if (sunDisagrees(bedSun.get(bedId), planting.sunRequirements)) {
      flags.push({
        kind: 'sun',
        plantingIds: [planting.id],
        blocking: false,
        message: `${planting.commonName ?? 'Plant'} wants different sun than this bed`,
      });
    }
    const repeated = (input.priorCrops ?? []).some(
      (crop) => crop.bedId === bedId && crop.plantId === planting.plantId,
    );
    if (repeated) {
      flags.push({
        kind: 'repeat',
        plantingIds: [planting.id],
        blocking: false,
        message: `${planting.commonName ?? 'Plant'} grew in this bed last year`,
      });
    }
  }

  for (const pair of input.pairs ?? []) {
    const key = [pair.plantId, pair.otherPlantId].sort().join(':') + ':' + pair.kind;
    if (seenPairs.has(key)) continue;
    const together = placed.some((a) => {
      if (a.plantId !== pair.plantId && a.plantId !== pair.otherPlantId) return false;
      const otherId = a.plantId === pair.plantId ? pair.otherPlantId : pair.plantId;
      return placed.some(
        (b) => b.plantId === otherId && b.placement!.bedId === a.placement!.bedId && b.id !== a.id,
      );
    });
    if (!together) continue;
    seenPairs.add(key);
    const verb = pair.kind === 'helps' ? 'helps' : pair.kind === 'hinders' ? 'hinders' : 'pollinates';
    const left = pair.plantName || names.get(pair.plantId) || 'Plant';
    const right = pair.otherName || names.get(pair.otherPlantId) || 'Plant';
    const ids = placed
      .filter((p) => p.plantId === pair.plantId || p.plantId === pair.otherPlantId)
      .map((p) => p.id);
    flags.push({
      kind: 'companion',
      plantingIds: ids,
      blocking: false,
      message: `${left} ${verb} ${right}${pair.reason ? ` — ${pair.reason}` : ''}`,
    });
  }

  return flags;
}
