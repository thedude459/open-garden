import type {
  CatalogPestDto,
  CropCoefficientsDto,
  ReminderItemDto,
  ScoutStage,
} from '@open-garden/shared-types';
import { diffIsoDateDays } from './dates';
import { greatestCursor, openRepeatingDueOn } from './derive';

const ALL_STAGES: readonly ScoutStage[] = ['seedling', 'vegetative', 'flowering', 'fruiting'];
const WEEK = 7;

/** A planting in a bed, as far as scouting needs it. */
export interface ScoutPlantingInput {
  bedId: string;
  bedName: string;
  cropId: string | null;
  plantedOn: string | null;
  harvestedOn: string | null;
  /** False for a perennial or a tree, whose stages restart each year. */
  annual: boolean;
  stageDays: CropCoefficientsDto['stageDays'];
}

/**
 * The crop stages a planting is at on `asOf`, from its FAO stage lengths
 * (ADR 0046): initial is seedling, development vegetative, mid-season
 * flowering and fruit set, late fruiting.
 *
 * ponytail: without stage lengths, or for a perennial (its stages follow the
 * season, not the planting date), every stage counts, so each of its crop's
 * pests is named; the upgrade is a start-of-season date for perennials.
 */
export function stagesOn(planting: ScoutPlantingInput, asOf: string): readonly ScoutStage[] {
  const d = planting.stageDays;
  if (!planting.annual || !d || !planting.plantedOn) return ALL_STAGES;
  const age = diffIsoDateDays(planting.plantedOn, asOf);
  if (age < d.initial) return ['seedling'];
  if (age < d.initial + d.development) return ['vegetative'];
  if (age < d.initial + d.development + d.mid) return ['flowering', 'fruiting'];
  return ['fruiting'];
}

/**
 * One weekly Scout task per bed (ADR 0046), naming the pests to look for:
 * those of the bed's growing crops, at the stages they are at, that are known
 * in the property's country or whose range is not known. A bed with none has
 * no task. `events` are the bed's scouting done or dismissed.
 */
export function deriveScoutTasks(
  plantings: readonly ScoutPlantingInput[],
  pests: readonly CatalogPestDto[],
  country: string | null,
  events: ReadonlyArray<{ bedId: string; occurrenceOn: string }>,
  asOf: string,
): ReminderItemDto[] {
  const here = pests.filter((p) => !country || p.occursIn === null || p.occursIn.includes(country));
  const beds = new Map<string, { name: string; plantedOn: string; pests: Map<string, string> }>();
  for (const planting of plantings) {
    const { cropId, plantedOn } = planting;
    if (!cropId || !plantedOn || plantedOn > asOf || planting.harvestedOn) continue;
    const stages = stagesOn(planting, asOf);
    const found = here.filter(
      (p) => p.crops.includes(cropId) && p.scoutStages.some((s) => stages.includes(s)),
    );
    if (!found.length) continue;
    const bed = beds.get(planting.bedId) ?? {
      name: planting.bedName,
      plantedOn,
      pests: new Map<string, string>(),
    };
    if (plantedOn < bed.plantedOn) bed.plantedOn = plantedOn;
    for (const pest of found) bed.pests.set(pest.id, pest.name);
    beds.set(planting.bedId, bed);
  }

  return [...beds].map(([bedId, bed]) => {
    const cursor = greatestCursor(
      events
        .filter((e) => e.bedId === bedId)
        .map((e) => ({ plantingId: bedId, kind: 'scout' as const, occurrenceOn: e.occurrenceOn })),
    );
    const dueOn = openRepeatingDueOn(bed.plantedOn, WEEK, asOf, cursor);
    const named = [...bed.pests]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      // A Scout task's subject is its bed, so the bed's id stands where a
      // planting's would (ADR 0046).
      plantingId: bedId,
      kind: 'scout',
      dueOn,
      urgency: dueOn < asOf ? 'overdue' : dueOn === asOf ? 'dueToday' : 'upcoming',
      intervalDays: WEEK,
      plantId: '',
      commonName: named.map((p) => p.name).join(', '),
      species: '',
      cultivar: null,
      plantType: 'vegetable',
      status: 'active',
      required: true,
      rainNote: null,
      bedId,
      bedName: bed.name,
      pests: named,
    };
  });
}
