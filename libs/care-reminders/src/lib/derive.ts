import type {
  CareKind,
  CropCoefficientsDto,
  PlantStatus,
  PlantType,
  ReminderItemDto,
  ReminderUrgency,
} from '@open-garden/shared-types';
import { addIsoDateDays, diffIsoDateDays } from './dates';
import { waterDue, type DayWater } from './water-balance';

export interface DerivePlantingInput {
  plantingId: string;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  status: PlantStatus;
  /** The day it is meant to be sown or planted out; only a planned planting has a Sow task. */
  plannedOn?: string | null;
  /** The day it was really sown or planted out (ADR 0040); care starts from it. */
  plantedOn: string | null;
  harvestedOn: string | null;
  daysToMaturity: number | null;
  waterIntervalDays: number | null;
  fertilizeIntervalDays: number | null;
  bedId?: string | null;
  bedName?: string | null;
  /**
   * Set for a planting in a bed whose crop has coefficients: watering then
   * follows the water balance (ADR 0035) instead of `waterIntervalDays`.
   */
  water?: { kc: CropCoefficientsDto; annual: boolean; factor: number } | null;
}

export interface DeriveEventInput {
  plantingId: string;
  kind: CareKind;
  occurrenceOn: string;
  /** The day the member completed or dismissed it, when known. */
  recordedOn?: string;
}

/** The last day watering was dealt with: done, or dismissed as not needed. */
function lastWateredOn(events: DeriveEventInput[]): string | null {
  let last: string | null = null;
  for (const event of events) {
    const day = event.recordedOn ?? event.occurrenceOn;
    if (!last || day > last) last = day;
  }
  return last;
}

function urgency(dueOn: string, asOf: string): ReminderUrgency {
  if (dueOn < asOf) return 'overdue';
  if (dueOn === asOf) return 'dueToday';
  return 'upcoming';
}

export function openRepeatingDueOn(
  plantedOn: string,
  intervalDays: number,
  asOf: string,
  cursor: DeriveEventInput | undefined,
): string {
  if (cursor) {
    return addIsoDateDays(cursor.occurrenceOn, intervalDays);
  }
  if (plantedOn > asOf) {
    return plantedOn;
  }
  const daysSince = diffIsoDateDays(plantedOn, asOf);
  const n = Math.floor(daysSince / intervalDays);
  return addIsoDateDays(plantedOn, n * intervalDays);
}

export function greatestCursor(events: DeriveEventInput[]): DeriveEventInput | undefined {
  if (events.length === 0) return undefined;
  return [...events].sort((a, b) => b.occurrenceOn.localeCompare(a.occurrenceOn))[0];
}

function plantingItem(
  planting: DerivePlantingInput,
  kind: CareKind,
  dueOn: string,
  asOf: string,
  intervalDays: number | null,
): ReminderItemDto {
  return {
    plantingId: planting.plantingId,
    kind,
    dueOn,
    urgency: urgency(dueOn, asOf),
    intervalDays,
    plantId: planting.plantId,
    commonName: planting.commonName,
    species: planting.species,
    cultivar: planting.cultivar,
    plantType: planting.plantType,
    status: planting.status,
    required: true,
    rainNote: null,
    bedId: planting.bedId ?? null,
    bedName: planting.bedName ?? null,
  };
}

export function deriveReminders(
  plantings: DerivePlantingInput[],
  events: DeriveEventInput[],
  asOf: string,
  /** Evapotranspiration and rain by day; without it, watering follows fixed intervals. */
  weather: Record<string, DayWater> | null = null,
): ReminderItemDto[] {
  const eventsByPlanting = new Map<string, DeriveEventInput[]>();
  for (const event of events) {
    const list = eventsByPlanting.get(event.plantingId) ?? [];
    list.push(event);
    eventsByPlanting.set(event.plantingId, list);
  }

  const items: ReminderItemDto[] = [];

  for (const planting of plantings) {
    const plantingEvents = eventsByPlanting.get(planting.plantingId) ?? [];
    const harvestEvents = plantingEvents.filter((e) => e.kind === 'harvest');
    const waterEvents = plantingEvents.filter((e) => e.kind === 'water');
    const fertilizeEvents = plantingEvents.filter((e) => e.kind === 'fertilize');

    // A planned planting's one task (ADR 0040): sow it. Marking the task done
    // marks it planted; dismissing it hides this date until the plan moves.
    const plannedOn = planting.plannedOn;
    if (
      plannedOn &&
      !planting.plantedOn &&
      !planting.harvestedOn &&
      !plantingEvents.some((e) => e.kind === 'sow' && e.occurrenceOn === plannedOn)
    ) {
      items.push(plantingItem(planting, 'sow', plannedOn, asOf, null));
    }

    if (
      !planting.harvestedOn &&
      harvestEvents.length === 0 &&
      planting.plantedOn &&
      planting.daysToMaturity != null &&
      planting.daysToMaturity > 0
    ) {
      const dueOn = addIsoDateDays(planting.plantedOn, planting.daysToMaturity);
      items.push(plantingItem(planting, 'harvest', dueOn, asOf, null));
    }

    if (planting.plantedOn) {
      const balance =
        planting.water && weather && !planting.harvestedOn
          ? waterDue(
              {
                plantedOn: planting.plantedOn,
                lastWateredOn: lastWateredOn(waterEvents),
                ...planting.water,
              },
              weather,
              asOf,
            )
          : null;
      const waterInterval = planting.waterIntervalDays;
      if (balance === 'not-due') {
        // The soil holds enough water through the forecast.
      } else if (balance) {
        items.push({
          ...plantingItem(planting, 'water', balance.dueOn, asOf, null),
          deficitMm: balance.deficitMm,
        });
      } else if (waterInterval != null && waterInterval > 0) {
        const dueOn = openRepeatingDueOn(
          planting.plantedOn,
          waterInterval,
          asOf,
          greatestCursor(waterEvents),
        );
        items.push(plantingItem(planting, 'water', dueOn, asOf, waterInterval));
      }

      const fertilizeInterval = planting.fertilizeIntervalDays;
      if (fertilizeInterval != null && fertilizeInterval > 0) {
        const dueOn = openRepeatingDueOn(
          planting.plantedOn,
          fertilizeInterval,
          asOf,
          greatestCursor(fertilizeEvents),
        );
        items.push(plantingItem(planting, 'fertilize', dueOn, asOf, fertilizeInterval));
      }
    }
  }

  return items;
}
