import { eq } from 'drizzle-orm';
import type { CareAction, CareKind } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { gardenCareEvents, gardenPlantings } from './schema';

export class CareEventRepository {
  constructor(private readonly db: AppDatabase) {}

  async listForGarden(
    gardenId: string,
  ): Promise<Array<{ plantingId: string; kind: CareKind; occurrenceOn: string }>> {
    const rows = await this.db
      .select({
        plantingId: gardenCareEvents.plantingId,
        kind: gardenCareEvents.kind,
        occurrenceOn: gardenCareEvents.occurrenceOn,
      })
      .from(gardenCareEvents)
      .innerJoin(gardenPlantings, eq(gardenCareEvents.plantingId, gardenPlantings.id))
      .where(eq(gardenPlantings.gardenId, gardenId));

    return rows.map((row) => ({
      plantingId: row.plantingId,
      kind: row.kind as CareKind,
      occurrenceOn: row.occurrenceOn,
    }));
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
