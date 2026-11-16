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
  /** Saved beds no longer in the draft (an undo past their creation). */
  removedBedIds: string[];
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
  const draftBeds = new Set(draft.beds.map((b) => b.id));
  return {
    newBeds: draft.beds.filter((b) => !savedBeds.has(b.id)),
    newDirectSeeds: draft.plantings.filter(
      (p) => p.startMethod === 'direct_seed' && !savedSeeds.has(p.id),
    ),
    removedDirectSeedIds: [...savedSeeds].filter((id) => !draftIds.has(id)),
    removedBedIds: [...savedBeds].filter((id) => !draftBeds.has(id)),
    layoutChanged: JSON.stringify(layoutPutBody(saved)) !== JSON.stringify(layoutPutBody(draft)),
  };
}

/** Whether a draft has anything to save. */
export function hasLayoutChanges(changes: LayoutChanges): boolean {
  return (
    changes.layoutChanged ||
    changes.newBeds.length > 0 ||
    changes.newDirectSeeds.length > 0 ||
    changes.removedDirectSeedIds.length > 0 ||
    changes.removedBedIds.length > 0
  );
}

/**
 * An earlier draft to go back to, keeping each bed's current name and
 * settings: those are saved as they change, outside the layout, so an undo of
 * a move must not bring back an old name.
 */
export function restoreLayout(current: GardenLayoutDto, earlier: GardenLayoutDto): GardenLayoutDto {
  const now = new Map(current.beds.map((b) => [b.id, b]));
  return {
    ...earlier,
    beds: earlier.beds.map((b) => {
      const bed = now.get(b.id);
      return bed ? { ...bed, geometry: b.geometry } : b;
    }),
  };
}
