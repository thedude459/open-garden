import type { LayoutAreaDto, LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { plantingFootprintRadius } from './footprint';
import { localToPlan, bedPlanSize } from './rotate';

export type PlanHit =
  | { kind: 'planting'; plantingId: string }
  | { kind: 'area-handle'; areaId: string }
  | { kind: 'area'; areaId: string }
  | { kind: 'bed-handle'; bedId: string }
  | { kind: 'bed'; bedId: string }
  | { kind: 'empty' };

export type PlanGesture =
  | 'pan'
  | 'move-planting'
  | 'move-area'
  | 'resize-area'
  | 'move-bed'
  | 'resize-bed';

export function classifyGesture(hit: PlanHit): PlanGesture {
  switch (hit.kind) {
    case 'empty':
      return 'pan';
    case 'planting':
      return 'move-planting';
    case 'area':
      return 'move-area';
    case 'area-handle':
      return 'resize-area';
    case 'bed':
      return 'move-bed';
    case 'bed-handle':
      return 'resize-bed';
  }
}

/** Pointerup with movement below this (plan inches) is a click, not a drag. */
export const CLICK_INCH_THRESHOLD = 4;

export function isClickNotDrag(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold = CLICK_INCH_THRESHOLD,
): boolean {
  return Math.hypot(endX - startX, endY - startY) < threshold;
}

/**
 * Hit-test in plan inches.
 * Order: planting, area handle, area body, bed handle, bed body, empty.
 * Later beds/areas/plantings win when overlapping (drawn on top).
 */
export function hitTestPlan(
  beds: LayoutBedDto[],
  plantings: LayoutPlantingDto[],
  planX: number,
  planY: number,
  handleInches: number,
  areas: LayoutAreaDto[] = [],
  includePlantings = true,
): PlanHit {
  if (includePlantings) {
    for (const planting of [...plantings].reverse()) {
      const place = planting.placement;
      if (!place) continue;
      const bed = beds.find((b) => b.id === place.bedId && b.geometry);
      if (!bed?.geometry) continue;
      const center = localToPlan(bed.geometry, place.xInches, place.yInches);
      const r = plantingFootprintRadius(planting.spacingInches);
      const dx = planX - center.x;
      const dy = planY - center.y;
      if (dx * dx + dy * dy <= r * r) {
        return { kind: 'planting', plantingId: planting.id };
      }
    }
  }

  const drawnAreas = [...areas].reverse();
  for (const area of drawnAreas) {
    const box = areaBox(area);
    if (inHandle(planX, planY, box, handleInches)) {
      return { kind: 'area-handle', areaId: area.id };
    }
  }
  for (const area of drawnAreas) {
    if (inBox(planX, planY, areaBox(area))) {
      return { kind: 'area', areaId: area.id };
    }
  }

  const drawnBeds = [...beds].reverse();
  for (const bed of drawnBeds) {
    if (!bed.geometry) continue;
    const box = bedBox(bed);
    if (inHandle(planX, planY, box, handleInches)) {
      return { kind: 'bed-handle', bedId: bed.id };
    }
  }
  for (const bed of drawnBeds) {
    if (!bed.geometry) continue;
    if (inBox(planX, planY, bedBox(bed))) {
      return { kind: 'bed', bedId: bed.id };
    }
  }
  return { kind: 'empty' };
}

function bedBox(bed: LayoutBedDto): { x0: number; y0: number; x1: number; y1: number } {
  const geo = bed.geometry!;
  const size = bedPlanSize(geo);
  return {
    x0: geo.originXInches,
    y0: geo.originYInches,
    x1: geo.originXInches + size.width,
    y1: geo.originYInches + size.height,
  };
}

function areaBox(area: LayoutAreaDto): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: area.originXInches,
    y0: area.originYInches,
    x1: area.originXInches + area.lengthInches,
    y1: area.originYInches + area.widthInches,
  };
}

function inBox(
  x: number,
  y: number,
  box: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
}

function inHandle(
  x: number,
  y: number,
  box: { x0: number; y0: number; x1: number; y1: number },
  handleInches: number,
): boolean {
  return x >= box.x1 - handleInches && x <= box.x1 && y >= box.y1 - handleInches && y <= box.y1;
}
