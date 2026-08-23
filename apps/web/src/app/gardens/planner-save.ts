import { evaluateLayout } from '@open-garden/garden-layout';
import type {
  BedCreateDto,
  GardenLayoutDto,
  LayoutPutDto,
  PlantingCreateDto,
} from '@open-garden/shared-types';

export interface PlannerSaveTracking {
  newBedIds: Set<string>;
  newDirectSeedIds: Set<string>;
  pendingDirectSeedDeletes: Set<string>;
}

export interface PlannerSaveDeps {
  createBed: (body: BedCreateDto) => Promise<void>;
  deleteBed: (id: string) => Promise<void>;
  createPlanting: (body: PlantingCreateDto) => Promise<void>;
  deletePlanting: (id: string) => Promise<void>;
  putLayout: (body: LayoutPutDto) => Promise<GardenLayoutDto>;
}

export function putBodyFromDraft(d: GardenLayoutDto): LayoutPutDto {
  return {
    beds: d.beds
      .filter((b) => b.geometry)
      .map((b) => ({
        id: b.id,
        originXInches: b.geometry!.originXInches,
        originYInches: b.geometry!.originYInches,
        lengthInches: b.geometry!.lengthInches,
        widthInches: b.geometry!.widthInches,
        orientation: b.geometry!.orientation,
      })),
    areas: d.areas ?? [],
    placements: d.plantings.filter((p) => p.placement).map((p) => p.placement!),
  };
}

export function draftIsDirty(
  d: GardenLayoutDto | null,
  savedPutJson: string,
  tracking: PlannerSaveTracking,
) {
  if (!d) return false;
  return (
    JSON.stringify(putBodyFromDraft(d)) !== savedPutJson ||
    tracking.newBedIds.size > 0 ||
    tracking.newDirectSeedIds.size > 0 ||
    tracking.pendingDirectSeedDeletes.size > 0
  );
}

/**
 * evaluate → POST beds → POST direct seeds → PUT layout → DELETE pending direct seeds.
 * On PUT failure, compensating DELETE of new beds and new direct-seed plantings.
 */
export async function savePlannerDraft(
  draft: GardenLayoutDto,
  tracking: PlannerSaveTracking,
  deps: PlannerSaveDeps,
): Promise<GardenLayoutDto> {
  const flags = evaluateLayout(draft.beds, draft.plantings);
  if (flags.some((f) => f.blocking)) {
    const err = new Error('Layout has spacing or fit problems') as Error & { code: string };
    err.code = 'SPACING';
    throw err;
  }
  const postedBeds: string[] = [];
  const postedPlantings: string[] = [];
  try {
    for (const id of tracking.newBedIds) {
      const bed = draft.beds.find((b) => b.id === id);
      if (!bed) continue;
      await deps.createBed({
        id: bed.id,
        name: bed.name,
        lengthInches: bed.geometry?.lengthInches ?? 96,
        widthInches: bed.geometry?.widthInches ?? 48,
        originXInches: bed.geometry?.originXInches ?? 0,
        originYInches: bed.geometry?.originYInches ?? 0,
      });
      postedBeds.push(id);
    }
    for (const id of tracking.newDirectSeedIds) {
      const planting = draft.plantings.find((p) => p.id === id);
      if (!planting) continue;
      await deps.createPlanting({
        id: planting.id,
        plantId: planting.plantId,
        startMethod: 'direct_seed',
        bedId: planting.bedId,
      });
      postedPlantings.push(id);
    }
    const saved = await deps.putLayout(putBodyFromDraft(draft));
    for (const id of tracking.pendingDirectSeedDeletes) {
      await deps.deletePlanting(id);
    }
    tracking.newBedIds.clear();
    tracking.newDirectSeedIds.clear();
    tracking.pendingDirectSeedDeletes.clear();
    return { ...saved, areas: saved.areas ?? [] };
  } catch (err) {
    for (const id of postedPlantings) {
      try {
        await deps.deletePlanting(id);
      } catch {
        /* keep attempting remaining compensating deletes */
      }
    }
    for (const id of postedBeds) {
      try {
        await deps.deleteBed(id);
      } catch {
        /* keep attempting remaining compensating deletes */
      }
    }
    throw err;
  }
}
