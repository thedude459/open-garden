import type { CareAction, CareKind, ReminderListDto } from '@open-garden/shared-types';
import { deriveReminders } from './derive';
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
      plantedOn: string | null;
      harvestedOn: string | null;
      daysToMaturity: number | null;
      waterIntervalDays: number | null;
      fertilizeIntervalDays: number | null;
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
    }>
  >;
  upsert(
    plantingId: string,
    kind: CareKind,
    occurrenceOn: string,
    action: CareAction,
  ): Promise<void>;
}

export class CareReminderService {
  constructor(
    private readonly memberships: GardenMembershipReader,
    private readonly plantings: ReminderPlantingReader,
    private readonly events: CareEventWriter,
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
      plantedOn: row.plantedOn,
      harvestedOn: row.harvestedOn,
      daysToMaturity: row.daysToMaturity,
      waterIntervalDays: row.waterIntervalDays,
      fertilizeIntervalDays: row.fertilizeIntervalDays,
    }));

    const items = sortReminders(deriveReminders(plantings, eventRows, asOf));

    return {
      gardenId,
      asOf,
      myRole: membership.role as ReminderListDto['myRole'],
      items,
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
