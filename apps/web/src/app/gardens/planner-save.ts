import { evaluateLayout, layoutChanges, layoutPutBody } from '@open-garden/garden-layout';
import type {
  BedCreateDto,
  GardenLayoutDto,
  LayoutPlantingDto,
  LayoutPutDto,
  PlantingCreateDto,
} from '@open-garden/shared-types';

export interface PlannerSaveDeps {
  createBed: (body: BedCreateDto) => Promise<void>;
  deleteBed: (id: string) => Promise<void>;
  createPlanting: (body: PlantingCreateDto) => Promise<void>;
  deletePlanting: (id: string) => Promise<void>;
  putLayout: (body: LayoutPutDto) => Promise<GardenLayoutDto>;
}

/**
 * Whether a freshly fetched layout may replace the one on screen: not over
 * unsaved edits, and not over a change made while it loaded (a bed renamed),
 * which is newer than the response.
 */
export function freshLayoutApplies<T>(shownBefore: T, shownNow: T, dirty: boolean): boolean {
  return !dirty && shownNow === shownBefore;
}

/** Merge API waiting transplants into a draft planting list without dropping placements. */
export function mergeWaitingTransplants(
  draft: LayoutPlantingDto[],
  waiting: LayoutPlantingDto[],
): LayoutPlantingDto[] {
  const waitingIds = new Set(waiting.map((p) => p.id));
  // `waiting` is the loose list (no bed, no tray); a seedling in a greenhouse
  // tray is still waiting, so keep it rather than treat it as deleted.
  const kept = draft.filter(
    (p) =>
      p.placement !== null ||
      p.startMethod !== 'transplant' ||
      Boolean(p.trayId) ||
      waitingIds.has(p.id),
  );
  const existingIds = new Set(kept.map((p) => p.id));
  const added = waiting.filter((p) => !existingIds.has(p.id));
  if (added.length === 0 && kept.length === draft.length) return draft;
  return [...added, ...kept];
}

/**
 * Saves a draft against `saved`, the layout as last loaded or saved: what to
 * create, move, and delete comes from comparing the two (layoutChanges).
 * Problems the saved layout already had (a catalog update widened spacing) do
 * not block. See evaluateLayout.
 *
 * evaluate → POST beds → POST direct seeds → PUT layout → DELETE removed direct seeds, then
 * removed beds (only an undo past a bed's creation removes a saved bed here).
 * Creates in a phase run together. Beds finish before plantings, and both finish before PUT.
 * On PUT failure, compensating DELETE of new direct-seed plantings, then new beds.
 */
export async function savePlannerDraft(
  draft: GardenLayoutDto,
  saved: GardenLayoutDto,
  deps: PlannerSaveDeps,
): Promise<GardenLayoutDto> {
  const flags = evaluateLayout(draft.beds, draft.plantings, saved);
  if (flags.some((f) => f.blocking)) {
    const err = new Error('Layout has spacing or fit problems') as Error & { code: string };
    err.code = 'SPACING';
    throw err;
  }
  const changes = layoutChanges(saved, draft);
  const postedBeds: string[] = [];
  const postedPlantings: string[] = [];
  try {
    await Promise.all(
      changes.newBeds.map(async (bed) => {
        await deps.createBed({
          id: bed.id,
          name: bed.name,
          lengthInches: bed.geometry?.lengthInches ?? 96,
          widthInches: bed.geometry?.widthInches ?? 48,
          originXInches: bed.geometry?.originXInches ?? 0,
          originYInches: bed.geometry?.originYInches ?? 0,
          ...(bed.site ? { site: bed.site } : {}),
          ...(bed.station ? { station: bed.station } : {}),
          ...(bed.mulch ? { mulch: bed.mulch } : {}),
        });
        postedBeds.push(bed.id);
      }),
    );
    await Promise.all(
      changes.newDirectSeeds.map(async (planting) => {
        await deps.createPlanting({
          id: planting.id,
          plantId: planting.plantId,
          startMethod: 'direct_seed',
          bedId: planting.bedId,
          ...(planting.spacingFeet ? { spacingFeet: planting.spacingFeet } : {}),
          ...(planting.rootstock ? { rootstock: planting.rootstock } : {}),
        });
        postedPlantings.push(planting.id);
      }),
    );
    const result = await deps.putLayout(layoutPutBody(draft));
    await Promise.all(changes.removedDirectSeedIds.map((id) => deps.deletePlanting(id)));
    await Promise.all(changes.removedBedIds.map((id) => deps.deleteBed(id)));
    return { ...result, areas: result.areas ?? [] };
  } catch (err) {
    await Promise.all(
      postedPlantings.map(async (id) => {
        try {
          await deps.deletePlanting(id);
        } catch {
          /* keep attempting remaining compensating deletes */
        }
      }),
    );
    await Promise.all(
      postedBeds.map(async (id) => {
        try {
          await deps.deleteBed(id);
        } catch {
          /* keep attempting remaining compensating deletes */
        }
      }),
    );
    throw err;
  }
}
