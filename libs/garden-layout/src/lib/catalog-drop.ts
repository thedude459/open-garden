import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { evaluateLayout } from './evaluate-layout';
import { planToLocal } from './plan-coords';
import { bedPlanSize } from './rotate';

export type CatalogDropOutcome = 'ok' | 'miss' | 'spacing' | 'fit';

const PROBE_ID = 'catalog-drop-probe';

/** Outcome for a new catalog-from-panel planting at a plan-inch point in the open bed. */
export function catalogDropOutcome(
  openBed: LayoutBedDto,
  existing: LayoutPlantingDto[],
  planX: number,
  planY: number,
  spacingInches: number,
): CatalogDropOutcome {
  const geo = openBed.geometry;
  if (!geo) return 'miss';
  const size = bedPlanSize(geo);
  if (
    planX < geo.originXInches ||
    planX > geo.originXInches + size.width ||
    planY < geo.originYInches ||
    planY > geo.originYInches + size.height
  ) {
    return 'miss';
  }
  const local = planToLocal(geo, planX, planY);
  const flags = evaluateLayout(
    [{ id: openBed.id, geometry: { lengthInches: geo.lengthInches, widthInches: geo.widthInches } }],
    [
      ...existing.map((p) => ({
        id: p.id,
        spacingInches: p.spacingInches,
        placement: p.placement,
      })),
      {
        id: PROBE_ID,
        spacingInches,
        placement: { bedId: openBed.id, xInches: local.x, yInches: local.y },
      },
    ],
  );
  const blocking = flags.filter((f) => f.blocking && f.plantingIds.includes(PROBE_ID));
  if (blocking.some((f) => f.kind === 'fit')) return 'fit';
  if (blocking.some((f) => f.kind === 'spacing')) return 'spacing';
  return 'ok';
}
