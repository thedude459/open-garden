import { gardenAccess } from '@open-garden/shared-types';
import type {
  CareAction,
  CareKind,
  CatalogPestDto,
  ReminderListDto,
} from '@open-garden/shared-types';
import { deriveReminders } from './derive';
import { deriveScoutTasks } from './derive-scout';
import { applyRainCover } from './rain-cover';
import { bedWaterFactor, type DayWater } from './water-balance';
import { sortReminders } from './sort';
import { CARE_ERRORS } from './domain-error';
import { isIsoDate } from './dates';

export interface GardenMembershipReader {
  getMembership(gardenId: string, userId: string): Promise<{ role: string } | null>;
}

export interface ReminderPlantingReader {
  listAllForReminders(gardenId: string): Promise<
    Array<{
      id: string;
      plantId: string;
      /** The dataset crop, whose pests a Scout task names (ADR 0046). */
      cropId?: string | null;
      commonName: string;
      species: string;
      cultivar: string | null;
      plantType: string;
      status: string;
      plannedOn?: string | null;
      plantedOn: string | null;
      harvestedOn: string | null;
      daysToMaturity: number | null;
      waterIntervalDays: number | null;
      fertilizeIntervalDays: number | null;
      bedId?: string | null;
      bedName?: string | null;
      /** For watering by water balance (ADR 0035). */
      life?: string | null;
      bedSun?: string | null;
      bedMulch?: string | null;
      kcInitial?: number | null;
      kcMid?: number | null;
      kcEnd?: number | null;
      stageDaysInitial?: number | null;
      stageDaysDevelopment?: number | null;
      stageDaysMid?: number | null;
      stageDaysLate?: number | null;
    }>
  >;
  getInGarden(gardenId: string, plantingId: string): Promise<{ id: string } | null>;
}

export interface CareEventWriter {
  listForGarden(gardenId: string): Promise<
    Array<{
      plantingId: string;
      kind: CareKind;
      occurrenceOn: string;
      recordedOn?: string;
    }>
  >;
  upsert(
    plantingId: string,
    kind: CareKind,
    occurrenceOn: string,
    action: CareAction,
  ): Promise<void>;
  remove?(plantingId: string, kind: CareKind, occurrenceOn: string): Promise<void>;
}

/** What a bed's weekly Scout task needs (ADR 0046). */
export interface ScoutingSources {
  /** The pests of any of these crops. */
  pests(cropIds: string[]): Promise<CatalogPestDto[]>;
  /** The property's country (ISO 3166-1 alpha-2), when known. */
  country(gardenId: string): Promise<string | null>;
  bedInGarden(gardenId: string, bedId: string): Promise<boolean>;
  listForGarden(gardenId: string): Promise<Array<{ bedId: string; occurrenceOn: string }>>;
  upsert(bedId: string, occurrenceOn: string, action: CareAction): Promise<void>;
  remove(bedId: string, occurrenceOn: string): Promise<void>;
  /** Pests marked not a problem at the property (ADR 0047). */
  ignored(gardenId: string): Promise<string[]>;
  ignore(gardenId: string, pestId: string): Promise<void>;
  restore(gardenId: string, pestId: string): Promise<void>;
  /** The ids and names of these pests that the catalog holds. */
  names(pestIds: string[]): Promise<Array<{ id: string; name: string }>>;
}

export class CareReminderService {
  constructor(
    private readonly memberships: GardenMembershipReader,
    private readonly plantings: ReminderPlantingReader,
    private readonly events: CareEventWriter,
    /** A property's evapotranspiration and rain by day; null when it has no location or the weather cannot be read. */
    private readonly weather: (
      gardenId: string,
      asOf: string,
    ) => Promise<Record<string, DayWater> | null>,
    private readonly scouting: ScoutingSources,
  ) {}

  async list(gardenId: string, userId: string, asOf: string): Promise<ReminderListDto> {
    if (!isIsoDate(asOf)) {
      throw CARE_ERRORS.dateRequired();
    }
    const membership = await this.memberships.getMembership(gardenId, userId);
    if (!membership) {
      throw CARE_ERRORS.gardenNotFound();
    }

    const rows = await this.plantings.listAllForReminders(gardenId);
    const eventRows = await this.events.listForGarden(gardenId);

    const plantings = rows.map((row) => ({
      plantingId: row.id,
      plantId: row.plantId,
      commonName: row.commonName,
      species: row.species,
      cultivar: row.cultivar,
      plantType: row.plantType as ReminderListDto['items'][0]['plantType'],
      status: row.status as ReminderListDto['items'][0]['status'],
      plannedOn: row.plannedOn ?? null,
      plantedOn: row.plantedOn,
      harvestedOn: row.harvestedOn,
      daysToMaturity: row.daysToMaturity,
      waterIntervalDays: row.waterIntervalDays,
      fertilizeIntervalDays: row.fertilizeIntervalDays,
      bedId: row.bedId ?? null,
      bedName: row.bedName ?? null,
      water: waterInput(row),
    }));

    // A forecast that cannot be read means fixed intervals, never a failed list.
    const weather = await this.weather(gardenId, asOf).catch(() => null);
    const rain = weather
      ? Object.fromEntries(Object.entries(weather).map(([day, w]) => [day, w.rainMm]))
      : null;
    const items = sortReminders([
      ...applyRainCover(deriveReminders(plantings, eventRows, asOf, weather), rain),
      ...(await this.scoutTasks(gardenId, rows, asOf)),
    ]);

    const ignored = await this.scouting.ignored(gardenId);
    return {
      gardenId,
      asOf,
      myRole: membership.role as ReminderListDto['myRole'],
      items,
      outlookOn: weather ? asOf : null,
      ignoredPests: await this.scouting.names(ignored),
    };
  }

  async complete(
    gardenId: string,
    userId: string,
    plantingId: string,
    kind: CareKind,
    dueOn: string,
  ): Promise<void> {
    await this.recordAction(gardenId, userId, plantingId, kind, dueOn, 'completed');
  }

  async undo(
    gardenId: string,
    userId: string,
    plantingId: string,
    kind: CareKind,
    dueOn: string,
  ): Promise<void> {
    if (!isIsoDate(dueOn)) throw CARE_ERRORS.dateRequired();
    gardenAccess(
      await this.memberships.getMembership(gardenId, userId),
      'edit',
      CARE_ERRORS.viewerReminders,
    );
    if (kind === 'scout') {
      if (!(await this.scouting.bedInGarden(gardenId, plantingId))) {
        throw CARE_ERRORS.plantingNotFound();
      }
      await this.scouting.remove(plantingId, dueOn);
      return;
    }
    const planting = await this.plantings.getInGarden(gardenId, plantingId);
    if (!planting) throw CARE_ERRORS.plantingNotFound();
    if (typeof this.events.remove === 'function') {
      await this.events.remove(plantingId, kind, dueOn);
    }
  }

  async dismiss(
    gardenId: string,
    userId: string,
    plantingId: string,
    kind: CareKind,
    dueOn: string,
  ): Promise<void> {
    await this.recordAction(gardenId, userId, plantingId, kind, dueOn, 'dismissed');
  }

  private async recordAction(
    gardenId: string,
    userId: string,
    plantingId: string,
    kind: CareKind,
    dueOn: string,
    action: CareAction,
  ): Promise<void> {
    if (!isIsoDate(dueOn)) {
      throw CARE_ERRORS.dateRequired();
    }
    gardenAccess(
      await this.memberships.getMembership(gardenId, userId),
      'edit',
      CARE_ERRORS.viewerReminders,
    );

    // A Scout task is the bed's (ADR 0046).
    if (kind === 'scout') {
      if (!(await this.scouting.bedInGarden(gardenId, plantingId))) {
        throw CARE_ERRORS.plantingNotFound();
      }
      await this.scouting.upsert(plantingId, dueOn, action);
      return;
    }

    const planting = await this.plantings.getInGarden(gardenId, plantingId);
    if (!planting) {
      throw CARE_ERRORS.plantingNotFound();
    }

    await this.events.upsert(plantingId, kind, dueOn, action);
  }

  /**
   * Marks a pest not a problem at this property, or names it again
   * (`restore`): its Scout tasks there leave it out (ADR 0047).
   */
  async ignorePest(gardenId: string, userId: string, pestId: string, restore = false) {
    gardenAccess(
      await this.memberships.getMembership(gardenId, userId),
      'edit',
      CARE_ERRORS.viewerReminders,
    );
    if (restore) {
      await this.scouting.restore(gardenId, pestId);
      return;
    }
    if ((await this.scouting.names([pestId])).length === 0) throw CARE_ERRORS.pestNotFound();
    await this.scouting.ignore(gardenId, pestId);
  }

  /** Each bed's weekly Scout task, naming the pests to look for. */
  private async scoutTasks(gardenId: string, rows: ReminderRow[], asOf: string) {
    const inBeds = rows.flatMap((row) =>
      row.bedId && row.cropId
        ? [
            {
              bedId: row.bedId,
              bedName: row.bedName ?? '',
              cropId: row.cropId,
              plantedOn: row.plantedOn,
              harvestedOn: row.harvestedOn,
              annual: !row.life || row.life === 'annual',
              stageDays: stageDaysOf(row),
            },
          ]
        : [],
    );
    if (!inBeds.length) return [];
    const [pests, country, events, ignored] = await Promise.all([
      this.scouting.pests([...new Set(inBeds.map((p) => p.cropId))]),
      this.scouting.country(gardenId),
      this.scouting.listForGarden(gardenId),
      this.scouting.ignored(gardenId),
    ]);
    const named = pests.filter((p) => !ignored.includes(p.id));
    return deriveScoutTasks(inBeds, named, country, events, asOf);
  }
}

type ReminderRow = Awaited<ReturnType<ReminderPlantingReader['listAllForReminders']>>[number];

/** A planting in a bed whose crop has coefficients waters by the water balance. */
function waterInput(row: ReminderRow) {
  if (!row.bedId || row.kcInitial == null || row.kcMid == null || row.kcEnd == null) return null;
  return {
    kc: { initial: row.kcInitial, mid: row.kcMid, end: row.kcEnd, stageDays: stageDaysOf(row) },
    annual: !row.life || row.life === 'annual',
    factor: bedWaterFactor(row.bedSun, row.bedMulch),
  };
}

/** The crop's FAO stage lengths, when the dataset has all four. */
function stageDaysOf(row: ReminderRow) {
  return row.stageDaysInitial && row.stageDaysDevelopment && row.stageDaysMid && row.stageDaysLate
    ? {
        initial: row.stageDaysInitial,
        development: row.stageDaysDevelopment,
        mid: row.stageDaysMid,
        late: row.stageDaysLate,
      }
    : null;
}
