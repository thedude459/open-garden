import { buildVarietyKey } from './variety-key';
import type { PlantDataProvider } from '@open-garden/plant-provider';
import type { PlantRepository, PlantUpsertInput } from '@open-garden/plant-catalog-data';
import type { PageDto, PlantListQueryDto, PlantSummaryDto, PlantType } from '@open-garden/shared-types';
import { PLANT_TYPES } from '@open-garden/shared-types';

export class CatalogService {
  constructor(
    private readonly plants: PlantRepository,
    private readonly provider: PlantDataProvider,
  ) {}

  async list(query: PlantListQueryDto): Promise<PageDto<PlantSummaryDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const zone = query.zone;
    if (zone !== undefined && (zone < 1 || zone > 13)) {
      throw validationError('zone must be between 1 and 13');
    }
    if (query.plantType && !PLANT_TYPES.includes(query.plantType)) {
      throw validationError('invalid plantType');
    }

    const q = query.q?.trim() ?? '';
    let result = await this.plants.list({
      q: q || undefined,
      zone,
      plantType: query.plantType,
      page,
      pageSize,
    });

    // Miss-fill only when name search has zero local hits
    if (q && result.totalCount === 0) {
      try {
        const remote = await this.provider.searchByName(q, { limit: 20 });
        for (const item of remote) {
          await this.plants.upsertByVarietyKey(toUpsert(item, this.provider.id));
        }
        result = await this.plants.list({
          q,
          zone,
          plantType: query.plantType,
          page,
          pageSize,
        });
      } catch {
        // Provider failure → empty local result (same UX as miss)
      }
    }

    return {
      items: result.items.map(toSummary),
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
    };
  }
}

export function matchesZone(
  zoneMin: number,
  zoneMax: number,
  zone: number,
): boolean {
  return zoneMin <= zone && zone <= zoneMax;
}

export function matchesPlantType(plantType: string, filter: PlantType): boolean {
  return plantType === filter;
}

function toUpsert(
  item: {
    externalId: string;
    commonName: string;
    species: string;
    cultivar: string | null;
    plantType: PlantType;
    zoneMin: number | null;
    zoneMax: number | null;
    sunRequirements: string | null;
    waterNeeds: string | null;
    daysToMaturity: number | null;
    spacingInches: number | null;
  },
  providerId: string,
): PlantUpsertInput {
  return {
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
    provider: providerId,
    providerExternalId: item.externalId,
  };
}

function toSummary(row: {
  id: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: string;
  zoneMin: number;
  zoneMax: number;
}): PlantSummaryDto {
  return {
    id: row.id,
    commonName: row.commonName,
    species: row.species,
    cultivar: row.cultivar,
    plantType: row.plantType as PlantType,
    zoneMin: row.zoneMin,
    zoneMax: row.zoneMax,
  };
}

function validationError(message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = 'VALIDATION_ERROR';
  return err;
}
