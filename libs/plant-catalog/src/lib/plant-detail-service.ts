import type { FavoriteRepository, PlantRepository } from '@open-garden/plant-catalog-data';
import type {
  FrostRelativeWeeksDto,
  GrowingGuidanceDto,
  PlantDetailDto,
  PlantStatus,
  PlantType,
} from '@open-garden/shared-types';

export class PlantDetailService {
  constructor(
    private readonly plants: PlantRepository,
    private readonly favorites: FavoriteRepository,
  ) {}

  async getById(plantId: string, userId: string): Promise<PlantDetailDto | null> {
    const row = await this.plants.getById(plantId);
    if (!row) return null;
    const isFavorite = await this.favorites.isFavorite(userId, plantId);
    return {
      id: row.id,
      commonName: row.commonName,
      species: row.species,
      cultivar: row.cultivar,
      plantType: row.plantType as PlantType,
      zoneMin: row.zoneMin,
      zoneMax: row.zoneMax,
      sunRequirements: row.sunRequirements,
      waterNeeds: row.waterNeeds,
      daysToMaturity: row.daysToMaturity,
      spacingInches: row.spacingInches,
      status: row.status as PlantStatus,
      isFavorite,
      growingGuidance: growingGuidanceFromRow(row),
    };
  }
}

export function growingGuidanceFromRow(row: {
  indoorFrostAnchor: string | null;
  indoorWeeksEarliest: number | null;
  indoorWeeksLatest: number | null;
  sowFrostAnchor: string | null;
  sowWeeksEarliest: number | null;
  sowWeeksLatest: number | null;
  transplantFrostAnchor: string | null;
  transplantWeeksEarliest: number | null;
  transplantWeeksLatest: number | null;
}): GrowingGuidanceDto {
  return {
    indoorStart: triplet(row.indoorFrostAnchor, row.indoorWeeksEarliest, row.indoorWeeksLatest),
    outdoorSow: triplet(row.sowFrostAnchor, row.sowWeeksEarliest, row.sowWeeksLatest),
    transplant: triplet(
      row.transplantFrostAnchor,
      row.transplantWeeksEarliest,
      row.transplantWeeksLatest,
    ),
  };
}

function triplet(
  anchor: string | null,
  earliest: number | null,
  latest: number | null,
): FrostRelativeWeeksDto | null {
  if (anchor !== 'last' && anchor !== 'first') return null;
  if (earliest == null || latest == null) return null;
  return { frostAnchor: anchor, weeksEarliest: earliest, weeksLatest: latest };
}
