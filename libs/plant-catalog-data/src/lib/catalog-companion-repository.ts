import { inArray, or } from 'drizzle-orm';
import type {
  CatalogCompanionDto,
  CompanionBenefit,
  CompanionEvidence,
  CompanionPlaceDto,
} from '@open-garden/shared-types';
import type { AppDatabase } from './db';
import { catalogCompanions, plants } from './schema';

/** A companion pair as the catalog import hands it over. */
export interface CatalogCompanionInput {
  crops: [string, string];
  kind: 'helps' | 'hinders';
  benefits: CompanionBenefit[];
  evidence: CompanionEvidence;
  reason: string;
  reference: string | null;
  shownIn: CompanionPlaceDto[];
}

type Row = typeof catalogCompanions.$inferSelect;

export class CatalogCompanionRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Swap in a release's pairs. Call inside the import's transaction. */
  async replaceAll(pairs: CatalogCompanionInput[]) {
    await this.db.delete(catalogCompanions);
    if (pairs.length === 0) return;
    await this.db.insert(catalogCompanions).values(
      pairs.map((pair) => ({
        cropId: pair.crops[0],
        otherCropId: pair.crops[1],
        kind: pair.kind,
        benefits: pair.benefits,
        evidence: pair.evidence,
        reason: pair.reason,
        reference: pair.reference,
        shownIn: pair.shownIn,
      })),
    );
  }

  /** Pairs that name any of these crops, each seen from both sides. */
  async listForCrops(
    cropIds: string[],
  ): Promise<Array<CatalogCompanionDto & { fromCropId: string }>> {
    if (cropIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(catalogCompanions)
      .where(
        or(
          inArray(catalogCompanions.cropId, cropIds),
          inArray(catalogCompanions.otherCropId, cropIds),
        ),
      );
    const wanted = new Set(cropIds);
    const names = await this.cropNames([
      ...new Set(rows.flatMap((row) => [row.cropId, row.otherCropId])),
    ]);
    return rows.flatMap((row) =>
      [
        [row.cropId, row.otherCropId],
        [row.otherCropId, row.cropId],
      ]
        .filter(([from]) => wanted.has(from!))
        .map(([from, other]) => ({ ...toDto(row, other!, names), fromCropId: from! })),
    );
  }

  /** The crop's own name, from its catalog row (the one without a variety). */
  private async cropNames(cropIds: string[]): Promise<Map<string, string>> {
    if (cropIds.length === 0) return new Map();
    const rows = await this.db
      .select({ varietyKey: plants.varietyKey, commonName: plants.commonName })
      .from(plants)
      .where(
        inArray(
          plants.varietyKey,
          cropIds.map((id) => `dataset:${id}`),
        ),
      );
    return new Map(rows.map((row) => [row.varietyKey.slice('dataset:'.length), row.commonName]));
  }
}

function toDto(row: Row, otherCropId: string, names: Map<string, string>): CatalogCompanionDto {
  return {
    cropId: otherCropId,
    name: names.get(otherCropId) ?? otherCropId,
    kind: row.kind === 'hinders' ? 'hinders' : 'helps',
    benefits: row.benefits as CompanionBenefit[],
    evidence: row.evidence as CompanionEvidence,
    reason: row.reason,
    reference: row.reference,
    shownIn: row.shownIn,
  };
}
