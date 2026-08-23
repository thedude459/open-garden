import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
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
