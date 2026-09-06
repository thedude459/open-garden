import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { evaluateLayout } from './evaluate-layout';
import { planToLocal } from './plan-coords';
import { bedPlanSize } from './rotate';

export type DropTarget =
  | { kind: 'bed'; bedId: string; planX: number; planY: number }
  | { kind: 'empty' }
  | { kind: 'tray' };

export function applyPlantingDrop(
  plantings: LayoutPlantingDto[],
  beds: LayoutBedDto[],
  plantingId: string,
  before: LayoutPlantingDto,
  target: DropTarget,
  selectedBedId?: string | null,
): LayoutPlantingDto[] {
  return plantings.map((planting) => {
    if (planting.id !== plantingId) return planting;
    if (target.kind === 'empty') {
      return { ...before };
    }
    if (target.kind === 'tray') {
      if (planting.startMethod === 'direct_seed') {
        return { ...before };
      }
      return { ...planting, bedId: null, placement: null };
    }
    const bedId = resolveBedId(beds, target, selectedBedId);
    const bed = beds.find((b) => b.id === bedId);
    if (!bed?.geometry) return { ...before };
    const local = planToLocal(bed.geometry, target.planX, target.planY);
    return {
      ...planting,
      bedId,
      placement: {
        plantingId: planting.id,
        bedId,
        xInches: local.x,
        yInches: local.y,
      },
    };
  });
}

function resolveBedId(
  beds: LayoutBedDto[],
  target: { kind: 'bed'; bedId: string; planX: number; planY: number },
  selectedBedId?: string | null,
): string {
  if (selectedBedId) {
    const selected = beds.find((b) => b.id === selectedBedId && b.geometry);
    if (selected?.geometry) {
      const { originXInches: x, originYInches: y } = selected.geometry;
      const size = bedPlanSize(selected.geometry);
      if (
        target.planX >= x &&
        target.planX <= x + size.width &&
        target.planY >= y &&
        target.planY <= y + size.height
      ) {
        return selected.id;
      }
    }
  }
  return target.bedId;
}

export type PlantingDropOutcome = 'ok' | 'spacing' | 'fit';

/** Blocking fit/spacing for the planting that just moved. Tray/empty drops skip this. */
export function plantingDropOutcome(
  beds: LayoutBedDto[],
  plantings: LayoutPlantingDto[],
  plantingId: string,
): PlantingDropOutcome {
  const flags = evaluateLayout(
    beds.map((bed) => ({
      id: bed.id,
      geometry: bed.geometry
        ? { lengthInches: bed.geometry.lengthInches, widthInches: bed.geometry.widthInches }
        : null,
    })),
    plantings.map((planting) => ({
      id: planting.id,
      spacingInches: planting.spacingInches,
      placement: planting.placement
        ? {
            bedId: planting.placement.bedId,
            xInches: planting.placement.xInches,
            yInches: planting.placement.yInches,
          }
        : null,
    })),
  );
  const blocking = flags.filter((f) => f.blocking && f.plantingIds.includes(plantingId));
  if (blocking.some((f) => f.kind === 'fit')) return 'fit';
  if (blocking.some((f) => f.kind === 'spacing')) return 'spacing';
  return 'ok';
}
