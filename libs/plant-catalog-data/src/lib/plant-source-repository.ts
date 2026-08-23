import { eq } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { catalogPlantSources } from './schema';

export interface PlantSourceLink {
  plantId: string;
  sourceId: string;
  externalId: string;
}

export class PlantSourceRepository {
  constructor(private readonly db: AppDatabase) {}

  async listAll(): Promise<PlantSourceLink[]> {
    return this.db
      .select({
        plantId: catalogPlantSources.plantId,
        sourceId: catalogPlantSources.sourceId,
        externalId: catalogPlantSources.externalId,
      })
      .from(catalogPlantSources);
  }

  async replaceForPlant(
    plantId: string,
    links: Array<{ sourceId: string; externalId: string }>,
  ): Promise<void> {
    await this.db.delete(catalogPlantSources).where(eq(catalogPlantSources.plantId, plantId));
    if (links.length === 0) return;
    await this.db.insert(catalogPlantSources).values(
      links.map((link) => ({
        plantId,
        sourceId: link.sourceId,
        externalId: link.externalId,
        updatedAt: new Date(),
      })),
    );
  }
}
