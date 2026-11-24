import type { CareAction, CareKind, ReminderListDto } from '@open-garden/shared-types';
import { deriveReminders } from './derive';
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
    const items = sortReminders(
      applyRainCover(deriveReminders(plantings, eventRows, asOf, weather), rain),
    );

    return {
      gardenId,
      asOf,
      myRole: membership.role as ReminderListDto['myRole'],
      items,
      outlookOn: weather ? asOf : null,
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
    const membership = await this.memberships.getMembership(gardenId, userId);
    if (!membership) throw CARE_ERRORS.gardenNotFound();
    if (membership.role === 'viewer') throw CARE_ERRORS.viewerReminders();
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
    const membership = await this.memberships.getMembership(gardenId, userId);
    if (!membership) {
      throw CARE_ERRORS.gardenNotFound();
    }
    if (membership.role === 'viewer') {
      throw CARE_ERRORS.viewerReminders();
    }

    const planting = await this.plantings.getInGarden(gardenId, plantingId);
    if (!planting) {
      throw CARE_ERRORS.plantingNotFound();
    }

    await this.events.upsert(plantingId, kind, dueOn, action);
  }
}

type ReminderRow = Awaited<ReturnType<ReminderPlantingReader['listAllForReminders']>>[number];

/** A planting in a bed whose crop has coefficients waters by the water balance. */
function waterInput(row: ReminderRow) {
  if (!row.bedId || row.kcInitial == null || row.kcMid == null || row.kcEnd == null) return null;
  const stages =
    row.stageDaysInitial && row.stageDaysDevelopment && row.stageDaysMid && row.stageDaysLate
      ? {
          initial: row.stageDaysInitial,
          development: row.stageDaysDevelopment,
          mid: row.stageDaysMid,
          late: row.stageDaysLate,
        }
      : null;
  return {
    kc: { initial: row.kcInitial, mid: row.kcMid, end: row.kcEnd, stageDays: stages },
    annual: !row.life || row.life === 'annual',
    factor: bedWaterFactor(row.bedSun, row.bedMulch),
  };
}
