import type {
  GardenLayoutDto,
  LayoutBedDto,
  LayoutPlantingDto,
  LayoutPutDto,
} from '@open-garden/shared-types';

/** What saving a plan draft has to send, worked out from the last saved layout. */
export interface LayoutChanges {
  /** Beds drawn since the last save. */
  newBeds: LayoutBedDto[];
  /** Plants sown straight into a bed since the last save. */
  newDirectSeeds: LayoutPlantingDto[];
  /** Saved direct-sown plants removed from the plan since. */
  removedDirectSeedIds: string[];
  /** Bed shapes, walkways, or placements differ from the last save. */
  layoutChanged: boolean;
}

/** The bed shapes, walkways, and placements a layout save writes. */
export function layoutPutBody(layout: GardenLayoutDto): LayoutPutDto {
  return {
    beds: layout.beds
      .filter((b) => b.geometry)
      .map((b) => ({
        id: b.id,
        originXInches: b.geometry!.originXInches,
        originYInches: b.geometry!.originYInches,
        lengthInches: b.geometry!.lengthInches,
        widthInches: b.geometry!.widthInches,
        orientation: b.geometry!.orientation,
      })),
    areas: layout.areas ?? [],
    placements: layout.plantings.filter((p) => p.placement).map((p) => p.placement!),
  };
}

/**
 * Compares a draft with the layout as last loaded or saved. Transplants are
 * created on the Transplants page, not by the plan, so only direct-sown plants
 * are created or deleted here; a transplant taken out of a bed just loses its
 * placement.
 */
export function layoutChanges(saved: GardenLayoutDto, draft: GardenLayoutDto): LayoutChanges {
  const savedBeds = new Set(saved.beds.map((b) => b.id));
  const savedSeeds = new Set(
    saved.plantings.filter((p) => p.startMethod === 'direct_seed').map((p) => p.id),
  );
  const draftIds = new Set(draft.plantings.map((p) => p.id));
  return {
    newBeds: draft.beds.filter((b) => !savedBeds.has(b.id)),
    newDirectSeeds: draft.plantings.filter(
      (p) => p.startMethod === 'direct_seed' && !savedSeeds.has(p.id),
    ),
    removedDirectSeedIds: [...savedSeeds].filter((id) => !draftIds.has(id)),
    layoutChanged: JSON.stringify(layoutPutBody(saved)) !== JSON.stringify(layoutPutBody(draft)),
  };
}

/** Whether a draft has anything to save. */
export function hasLayoutChanges(changes: LayoutChanges): boolean {
  return (
    changes.layoutChanged ||
    changes.newBeds.length > 0 ||
    changes.newDirectSeeds.length > 0 ||
    changes.removedDirectSeedIds.length > 0
  );
}
