import type { BedGeometryDto, Rootstock, RootstockSpacingDto } from '@open-garden/shared-types';
import { INCHES_PER_FOOT } from './display-units';
import { bedPlanSize } from './rotate';

/** A tree's spacing on a rootstock, or its catalog spacing when there is none. */
export function treeSpacingInches(
  plant: { spacingInches: number | null; rootstockSpacingInches?: RootstockSpacingDto | null },
  rootstock: Rootstock,
): number | null {
  return plant.rootstockSpacingInches?.[rootstock] ?? plant.spacingInches;
}

/**
 * A one-tree bed sized to the tree's spacing, in whole feet as a planting's
 * spacing is stored, around the same center. `shiftX`/`shiftY` move plantings
 * already in the bed (bed coordinates) so they keep their place on the plan.
 */
export function sizeTreeBed(geometry: BedGeometryDto, spacingInches: number) {
  const spacingFeet = Math.max(1, Math.round(spacingInches / INCHES_PER_FOOT));
  const size = spacingFeet * INCHES_PER_FOOT;
  const before = bedPlanSize(geometry);
  return {
    spacingFeet,
    geometry: {
      ...geometry,
      originXInches: Math.round(geometry.originXInches + (before.width - size) / 2),
      originYInches: Math.round(geometry.originYInches + (before.height - size) / 2),
      lengthInches: size,
      widthInches: size,
    },
    shiftX: Math.round((size - geometry.lengthInches) / 2),
    shiftY: Math.round((size - geometry.widthInches) / 2),
  };
}
