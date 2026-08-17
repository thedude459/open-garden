import { eq } from 'drizzle-orm';
import type { CareAction, CareKind } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenCareEvents, gardenPlantings } from './schema';

export class CareEventRepository {
  constructor(private readonly db: AppDatabase) {}

  async listForGarden(gardenId: string) {
    return this.db
      .select({
        plantingId: gardenCareEvents.plantingId,
        kind: gardenCareEvents.kind,
        occurrenceOn: gardenCareEvents.occurrenceOn,
      })
      .from(gardenCareEvents)
      .innerJoin(gardenPlantings, eq(gardenCareEvents.plantingId, gardenPlantings.id))
      .where(eq(gardenPlantings.gardenId, gardenId));
  }

  async upsertEvent(
    plantingId: string,
    kind: CareKind,
    occurrenceOn: string,
    action: CareAction,
  ) {
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
        target: [
          gardenCareEvents.plantingId,
          gardenCareEvents.kind,
          gardenCareEvents.occurrenceOn,
        ],
        set: {
          action,
          updatedAt: new Date(),
        },
      });
  }
}
