import { arrayOverlaps } from 'drizzle-orm';
import type { CatalogPestDto, PestKind, ScoutStage } from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { catalogPests } from './schema';

type Row = typeof catalogPests.$inferSelect;

export class CatalogPestRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Swap in a release's pests. Call inside the import's transaction. */
  async replaceAll(pests: CatalogPestDto[]) {
    await this.db.delete(catalogPests);
    if (pests.length === 0) return;
    await this.db.insert(catalogPests).values(
      pests.map((pest) => ({
        id: pest.id,
        name: pest.name,
        aliases: pest.aliases,
        scientificName: pest.scientificName,
        kind: pest.kind,
        crops: pest.crops,
        signs: pest.signs,
        scoutStages: pest.scoutStages,
        controls: pest.controls,
        occursIn: pest.occursIn,
        regions: pest.regions,
      })),
    );
  }

  /** Pests that attack any of these crops, A to Z. */
  async listForCrops(cropIds: string[]): Promise<CatalogPestDto[]> {
    if (cropIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(catalogPests)
      .where(arrayOverlaps(catalogPests.crops, cropIds))
      .orderBy(catalogPests.name);
    return rows.map(toDto);
  }
}

function toDto(row: Row): CatalogPestDto {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    scientificName: row.scientificName,
    kind: row.kind as PestKind,
    crops: row.crops,
    signs: row.signs,
    scoutStages: row.scoutStages as ScoutStage[],
    controls: row.controls,
    occursIn: row.occursIn,
    regions: row.regions,
  };
}
