import type {
  CareKind,
  PlantStatus,
  PlantType,
  ReminderItemDto,
  ReminderUrgency,
} from '@open-garden/shared-types';
import { addIsoDateDays, diffIsoDateDays } from './dates';

export interface DerivePlantingInput {
  plantingId: string;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  status: PlantStatus;
  plantedOn: string | null;
  harvestedOn: string | null;
  daysToMaturity: number | null;
  waterIntervalDays: number | null;
  fertilizeIntervalDays: number | null;
}

export interface DeriveEventInput {
  plantingId: string;
  kind: CareKind;
  occurrenceOn: string;
}

function urgency(dueOn: string, asOf: string): ReminderUrgency {
  if (dueOn < asOf) return 'overdue';
  if (dueOn === asOf) return 'dueToday';
  return 'upcoming';
}

function openRepeatingDueOn(
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

function greatestCursor(events: DeriveEventInput[]): DeriveEventInput | undefined {
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
  };
}

export function deriveReminders(
  plantings: DerivePlantingInput[],
  events: DeriveEventInput[],
  asOf: string,
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
      const waterInterval = planting.waterIntervalDays;
      if (waterInterval != null && waterInterval > 0) {
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
