import type { BedOrientation } from '@open-garden/shared-types';

export type RotatableBed = {
  originXInches: number;
  originYInches: number;
  lengthInches: number;
  widthInches: number;
  orientation: BedOrientation;
};

/** 90° step. Does not swap stored length/width or rewrite local placement coords. */
export function rotateBed90<T extends RotatableBed>(bed: T): T {
  const next = ((bed.orientation + 90) % 360) as BedOrientation;
  return { ...bed, orientation: next };
}

export function localToPlan(
  bed: RotatableBed,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const { originXInches: ox, originYInches: oy, lengthInches: L, widthInches: W, orientation } =
    bed;
  switch (orientation) {
    case 0:
      return { x: ox + localX, y: oy + localY };
    case 90:
      return { x: ox + localY, y: oy + L - localX };
    case 180:
      return { x: ox + L - localX, y: oy + W - localY };
    case 270:
      return { x: ox + W - localY, y: oy + localX };
  }
}

/** Axis-aligned size of the bed on the plan after orientation. */
export function bedPlanSize(bed: RotatableBed): { width: number; height: number } {
  if (bed.orientation === 90 || bed.orientation === 270) {
    return { width: bed.widthInches, height: bed.lengthInches };
  }
  return { width: bed.lengthInches, height: bed.widthInches };
}
