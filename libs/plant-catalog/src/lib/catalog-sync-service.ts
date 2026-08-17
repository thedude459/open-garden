import { buildVarietyKey } from './variety-key';
import type { PlantDataProvider } from '@open-garden/plant-provider';
import type { AppDatabase, PlantRepository } from '@open-garden/plant-catalog-data';
import { catalogSyncRuns } from '@open-garden/plant-catalog-data';
import { eq } from 'drizzle-orm';

export class CatalogSyncService {
  constructor(
    private readonly db: AppDatabase,
    private readonly plants: PlantRepository,
    private readonly provider: PlantDataProvider,
  ) {}

  async runOperatorSync(limit = 500): Promise<{ syncRunId: string; upserted: number }> {
    const [run] = await this.db
      .insert(catalogSyncRuns)
      .values({
        triggeredBy: 'operator',
        provider: this.provider.id,
        status: 'running',
      })
      .returning();

    if (!run) {
      throw new Error('Failed to create sync run');
    }

    try {
      let upserted = 0;
      let cursor: string | undefined;
      while (upserted < limit) {
        const page = await this.provider.listPage({
          cursor,
          limit: Math.min(50, limit - upserted),
        });
        for (const item of page.items) {
          await this.plants.upsertByVarietyKey({
            varietyKey: buildVarietyKey(item.species, item.cultivar),
            commonName: item.commonName,
            species: item.species,
            cultivar: item.cultivar,
            plantType: item.plantType,
            zoneMin: item.zoneMin ?? 1,
            zoneMax: item.zoneMax ?? 13,
            sunRequirements: item.sunRequirements,
            waterNeeds: item.waterNeeds,
            daysToMaturity: item.daysToMaturity,
            spacingInches: item.spacingInches,
            waterIntervalDays: item.waterIntervalDays ?? null,
            fertilizeIntervalDays: item.fertilizeIntervalDays ?? null,
            provider: this.provider.id,
            providerExternalId: item.externalId,
            growingGuidance: item.growingGuidance ?? null,
          });
          upserted += 1;
          if (upserted >= limit) break;
        }
        if (!page.nextCursor || page.items.length === 0) break;
        cursor = page.nextCursor;
      }

      await this.db
        .update(catalogSyncRuns)
        .set({
          status: 'succeeded',
          finishedAt: new Date(),
          plantsUpserted: upserted,
        })
        .where(eq(catalogSyncRuns.id, run.id));

      return { syncRunId: run.id, upserted };
    } catch (err) {
      await this.db
        .update(catalogSyncRuns)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : 'Sync failed',
        })
        .where(eq(catalogSyncRuns.id, run.id));
      throw err;
    }
  }
}
