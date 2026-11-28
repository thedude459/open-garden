import { and, eq } from 'drizzle-orm';
import type { CareAction, CareKind } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import {
  gardenBeds,
  gardenCareEvents,
  gardenIgnoredPests,
  gardenPlantings,
  gardenScoutEvents,
} from './schema';

export class CareEventRepository {
  constructor(private readonly db: AppDatabase) {}

  async listForGarden(
    gardenId: string,
  ): Promise<
    Array<{ plantingId: string; kind: CareKind; occurrenceOn: string; recordedOn: string }>
  > {
    const rows = await this.db
      .select({
        plantingId: gardenCareEvents.plantingId,
        kind: gardenCareEvents.kind,
        occurrenceOn: gardenCareEvents.occurrenceOn,
        updatedAt: gardenCareEvents.updatedAt,
      })
      .from(gardenCareEvents)
      .innerJoin(gardenPlantings, eq(gardenCareEvents.plantingId, gardenPlantings.id))
      .where(eq(gardenPlantings.gardenId, gardenId));

    return rows.map((row) => ({
      plantingId: row.plantingId,
      kind: row.kind as CareKind,
      occurrenceOn: row.occurrenceOn,
      // The day it was done (UTC), which the water balance counts from.
      recordedOn: row.updatedAt.toISOString().slice(0, 10),
    }));
  }

  async upsertEvent(plantingId: string, kind: CareKind, occurrenceOn: string, action: CareAction) {
    await this.db
      .insert(gardenCareEvents)
      .values({
        plantingId,
        kind,
        occurrenceOn,
        action,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [gardenCareEvents.plantingId, gardenCareEvents.kind, gardenCareEvents.occurrenceOn],
        set: {
          action,
          updatedAt: new Date(),
        },
      });
  }

  async deleteEvent(plantingId: string, kind: CareKind, occurrenceOn: string) {
    await this.db
      .delete(gardenCareEvents)
      .where(
        and(
          eq(gardenCareEvents.plantingId, plantingId),
          eq(gardenCareEvents.kind, kind),
          eq(gardenCareEvents.occurrenceOn, occurrenceOn),
        ),
      );
  }

  /** The beds' Scout tasks done or dismissed in a property (ADR 0046). */
  async listScoutsForGarden(
    gardenId: string,
  ): Promise<Array<{ bedId: string; occurrenceOn: string }>> {
    return this.db
      .select({ bedId: gardenScoutEvents.bedId, occurrenceOn: gardenScoutEvents.occurrenceOn })
      .from(gardenScoutEvents)
      .innerJoin(gardenBeds, eq(gardenScoutEvents.bedId, gardenBeds.id))
      .where(eq(gardenBeds.gardenId, gardenId));
  }

  async upsertScout(bedId: string, occurrenceOn: string, action: CareAction) {
    await this.db
      .insert(gardenScoutEvents)
      .values({ bedId, occurrenceOn, action, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [gardenScoutEvents.bedId, gardenScoutEvents.occurrenceOn],
        set: { action, updatedAt: new Date() },
      });
  }

  async deleteScout(bedId: string, occurrenceOn: string) {
    await this.db
      .delete(gardenScoutEvents)
      .where(
        and(eq(gardenScoutEvents.bedId, bedId), eq(gardenScoutEvents.occurrenceOn, occurrenceOn)),
      );
  }

  /** Pests marked not a problem at this property (ADR 0047). */
  async listIgnoredPests(gardenId: string): Promise<string[]> {
    const rows = await this.db
      .select({ pestId: gardenIgnoredPests.pestId })
      .from(gardenIgnoredPests)
      .where(eq(gardenIgnoredPests.gardenId, gardenId));
    return rows.map((r) => r.pestId);
  }

  async ignorePest(gardenId: string, pestId: string) {
    await this.db.insert(gardenIgnoredPests).values({ gardenId, pestId }).onConflictDoNothing();
  }

  async restorePest(gardenId: string, pestId: string) {
    await this.db
      .delete(gardenIgnoredPests)
      .where(and(eq(gardenIgnoredPests.gardenId, gardenId), eq(gardenIgnoredPests.pestId, pestId)));
  }
}
