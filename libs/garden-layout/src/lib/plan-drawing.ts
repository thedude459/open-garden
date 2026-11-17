import type {
  BedGeometryDto,
  LayoutAreaDto,
  LayoutBedDto,
  LayoutPlantingDto,
} from '@open-garden/shared-types';
import { drawableBeds } from './drawable-beds';
import type { DropTarget } from './drop';
import type { PlanHit } from './hit-test';
import type { PlanRect } from './plan-frame';
import { bedPlanSize, localToPlan } from './rotate';
import { fitClearance } from './spacing';

/** A rectangle on the plan, in inches from the plan's origin. */
export type PlanBox = { x: number; y: number; w: number; h: number };
export type PlanLine = { x1: number; y1: number; x2: number; y2: number };

/** The soil drawn inside a bed's frame: 3 inches in from each edge. */
export function soilSize(geo: BedGeometryDto): { width: number; height: number } {
  const size = bedPlanSize(geo);
  return { width: Math.max(1, size.width - 6), height: Math.max(1, size.height - 6) };
}

/** One-foot grid lines across a bed, kept off its frame. */
export function bedGridLines(geo: BedGeometryDto): PlanLine[] {
  const size = bedPlanSize(geo);
  const lines: PlanLine[] = [];
  const inset = 3;
  for (let x = 12; x < size.width - inset; x += 12) {
    lines.push({
      x1: geo.originXInches + x,
      y1: geo.originYInches + inset,
      x2: geo.originXInches + x,
      y2: geo.originYInches + size.height - inset,
    });
  }
  for (let y = 12; y < size.height - inset; y += 12) {
    lines.push({
      x1: geo.originXInches + inset,
      y1: geo.originYInches + y,
      x2: geo.originXInches + size.width - inset,
      y2: geo.originYInches + y,
    });
  }
  return lines;
}

/**
 * Where a plant at this spacing can be centred in a bed: the bed less its
 * fit clearance on every side. Null when the bed is too small for it.
 */
export function plantableRect(geo: BedGeometryDto, spacingInches: number): PlanBox | null {
  if (geo.lengthInches < spacingInches || geo.widthInches < spacingInches) return null;
  const clearance = fitClearance(spacingInches);
  const corners = [
    localToPlan(geo, clearance, clearance),
    localToPlan(geo, geo.lengthInches - clearance, clearance),
    localToPlan(geo, clearance, geo.widthInches - clearance),
    localToPlan(geo, geo.lengthInches - clearance, geo.widthInches - clearance),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/**
 * The edge bands where a plant at this spacing will not fit: the bed minus
 * its plantable rectangle. The whole bed when nothing fits.
 */
export function marginBands(geo: BedGeometryDto, spacingInches: number): PlanBox[] {
  const size = bedPlanSize(geo);
  const bed = { x: geo.originXInches, y: geo.originYInches, w: size.width, h: size.height };
  const inset = plantableRect(geo, spacingInches);
  if (!inset) return [bed];
  const bands: PlanBox[] = [];
  const top = inset.y - bed.y;
  const left = inset.x - bed.x;
  const bottom = bed.y + bed.h - (inset.y + inset.h);
  const right = bed.x + bed.w - (inset.x + inset.w);
  if (top > 0) bands.push({ x: bed.x, y: bed.y, w: bed.w, h: top });
  if (bottom > 0) bands.push({ x: bed.x, y: inset.y + inset.h, w: bed.w, h: bottom });
  if (left > 0) bands.push({ x: bed.x, y: inset.y, w: left, h: inset.h });
  if (right > 0) bands.push({ x: inset.x + inset.w, y: inset.y, w: right, h: inset.h });
  return bands;
}

/** The space every drawn bed and walkway covers, for framing the plan. */
export function contentRects(beds: LayoutBedDto[], areas: LayoutAreaDto[]): PlanRect[] {
  const rects: PlanRect[] = [];
  for (const bed of drawableBeds(beds)) {
    const geo = bed.geometry!;
    const size = bedPlanSize(geo);
    rects.push({
      x0: geo.originXInches,
      y0: geo.originYInches,
      x1: geo.originXInches + size.width,
      y1: geo.originYInches + size.height,
    });
  }
  for (const area of areas) {
    rects.push({
      x0: area.originXInches,
      y0: area.originYInches,
      x1: area.originXInches + area.lengthInches,
      y1: area.originYInches + area.widthInches,
    });
  }
  return rects;
}

/** The first bed whose drawn rectangle holds the point, edges included. */
export function bedAt(beds: LayoutBedDto[], planX: number, planY: number): LayoutBedDto | null {
  return (
    beds.find((bed) => {
      if (!bed.geometry) return false;
      const size = bedPlanSize(bed.geometry);
      return (
        planX >= bed.geometry.originXInches &&
        planX <= bed.geometry.originXInches + size.width &&
        planY >= bed.geometry.originYInches &&
        planY <= bed.geometry.originYInches + size.height
      );
    }) ?? null
  );
}

/**
 * What a planting dropped at this point lands in: the bed that was hit, or
 * the bed of the planting that was hit. Walkways and empty ground are misses.
 */
export function dropTargetAt(
  hit: PlanHit,
  plantings: LayoutPlantingDto[],
  plan: { x: number; y: number },
): DropTarget {
  if (hit.kind === 'bed' || hit.kind === 'bed-handle') {
    return { kind: 'bed', bedId: hit.bedId, planX: plan.x, planY: plan.y };
  }
  if (hit.kind !== 'planting') return { kind: 'empty' };
  const bedId = plantings.find((p) => p.id === hit.plantingId)?.placement?.bedId;
  return bedId ? { kind: 'bed', bedId, planX: plan.x, planY: plan.y } : { kind: 'empty' };
}

/** Space drawn between an area's beds and its outline, in inches. */
export const AREA_OUTLINE_PAD_INCHES = 12;

export type AreaOutline = PlanBox & { id: string; name: string };

/**
 * A box around each area's beds, so the plan shows where one area ends and
 * the next begins. Worked out from the beds, so nothing more is stored. Only
 * drawn when two or more areas have beds: one area's outline tells nothing.
 * ponytail: a bounding box, so areas whose beds interleave draw overlapping
 * boxes; an area with its own drawn shape is the upgrade if households need it.
 */
export function areaOutlines(
  beds: LayoutBedDto[],
  areas: { id: string; name: string }[],
): AreaOutline[] {
  const outlines: AreaOutline[] = [];
  for (const area of areas) {
    const rects = contentRects(
      drawableBeds(beds).filter((bed) => bed.areaId === area.id),
      [],
    );
    if (!rects.length) continue;
    const pad = AREA_OUTLINE_PAD_INCHES;
    // Kept inside the property: a bed at its corner would push the box past the plan's edge.
    const x = Math.max(0, Math.min(...rects.map((r) => r.x0)) - pad);
    const y = Math.max(0, Math.min(...rects.map((r) => r.y0)) - pad);
    outlines.push({
      id: area.id,
      name: area.name,
      x,
      y,
      w: Math.max(...rects.map((r) => r.x1)) + pad - x,
      h: Math.max(...rects.map((r) => r.y1)) + pad - y,
    });
  }
  return outlines.length > 1 ? outlines : [];
}
