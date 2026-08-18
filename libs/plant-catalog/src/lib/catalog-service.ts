import type { PlantListQueryDto, PageDto, PlantSummaryDto, PlantType } from '@open-garden/shared-types';
import { PLANT_TYPES } from '@open-garden/shared-types';
import type { PlantRepository } from '@open-garden/plant-catalog-data';

export class CatalogService {
  constructor(private readonly plants: PlantRepository) {}

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
    const result = await this.plants.list({
      q: q || undefined,
      zone,
      plantType: query.plantType,
      page,
      pageSize,
    });

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
