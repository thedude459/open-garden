import type {
  CatalogCompanionRepository,
  FavoriteRepository,
  PlantRepository,
} from '@open-garden/plant-catalog-data';
import type {
  CropCoefficientsDto,
  FrostRelativeWeeksDto,
  GrowingGuidanceDto,
  PlantDetailDto,
  PlantStatus,
  PlantType,
} from '@open-garden/shared-types';
import { rankCompanions } from './rank-companions';

export class PlantDetailService {
  constructor(
    private readonly plants: PlantRepository,
    private readonly favorites: FavoriteRepository,
    private readonly companions?: {
      pairs: Pick<CatalogCompanionRepository, 'listForCrops'>;
      /** Hardiness zones of the member's properties, to rank pairs by. */
      zonesForUser(userId: string): Promise<number[]>;
    },
  ) {}

  async getById(plantId: string, userId: string): Promise<PlantDetailDto | null> {
    const row = await this.plants.getById(plantId);
    if (!row) return null;
    const isFavorite = await this.favorites.isFavorite(userId, plantId);
    const { companions, companionZones } = await this.companionsFor(row.cropId ?? null, userId);
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
      waterIntervalDays: row.waterIntervalDays,
      fertilizeIntervalDays: row.fertilizeIntervalDays,
      status: row.status as PlantStatus,
      isFavorite,
      illustrationUrl: null,
      growingGuidance: growingGuidanceFromRow(row),
      sowingTemperature:
        row.growMinC != null && row.growMaxC != null
          ? { minC: row.growMinC, maxC: row.growMaxC, minSoilC: row.sowSoilMinC }
          : null,
      soilPh:
        row.soilPhMin != null && row.soilPhMax != null
          ? { min: row.soilPhMin, max: row.soilPhMax }
          : null,
      cropCoefficients: cropCoefficientsFromRow(row),
      companions,
      companionZones,
    };
  }

  private async companionsFor(cropId: string | null, userId: string) {
    if (!cropId || !this.companions) return { companions: [], companionZones: [] };
    const [rows, zones] = await Promise.all([
      this.companions.pairs.listForCrops([cropId]),
      this.companions.zonesForUser(userId),
    ]);
    const companions = rankCompanions(
      rows.map(({ fromCropId: _from, ...pair }) => pair),
      zones,
    );
    return { companions, companionZones: [...zones].sort((a, b) => a - b) };
  }
}

function cropCoefficientsFromRow(row: {
  kcInitial: number | null;
  kcMid: number | null;
  kcEnd: number | null;
  stageDaysInitial: number | null;
  stageDaysDevelopment: number | null;
  stageDaysMid: number | null;
  stageDaysLate: number | null;
}): CropCoefficientsDto | null {
  if (row.kcInitial == null || row.kcMid == null || row.kcEnd == null) return null;
  const { stageDaysInitial: i, stageDaysDevelopment: d, stageDaysMid: m, stageDaysLate: l } = row;
  return {
    initial: row.kcInitial,
    mid: row.kcMid,
    end: row.kcEnd,
    stageDays:
      i != null && d != null && m != null && l != null
        ? { initial: i, development: d, mid: m, late: l }
        : null,
  };
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
  fallSowWeeksEarliest: number | null;
  fallSowWeeksLatest: number | null;
}): GrowingGuidanceDto {
  return {
    indoorStart: triplet(row.indoorFrostAnchor, row.indoorWeeksEarliest, row.indoorWeeksLatest),
    outdoorSow: triplet(row.sowFrostAnchor, row.sowWeeksEarliest, row.sowWeeksLatest),
    transplant: triplet(
      row.transplantFrostAnchor,
      row.transplantWeeksEarliest,
      row.transplantWeeksLatest,
    ),
    fallSow: triplet('first', row.fallSowWeeksEarliest, row.fallSowWeeksLatest),
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
