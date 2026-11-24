/**
 * Habit first: `cane`, `shrub`, `vine` (a woody perennial vine such as grape),
 * and `tree` are that whatever their use; an herb of any habit is an herb.
 */
export type PlantType =
  'vegetable' | 'herb' | 'flower' | 'fruit' | 'cane' | 'shrub' | 'vine' | 'tree';

export type PlantStatus = 'active' | 'deprecated';

export const ROOTSTOCKS = ['dwarf', 'semiDwarf', 'standard'] as const;
export type Rootstock = (typeof ROOTSTOCKS)[number];
export const ROOTSTOCK_LABELS: Record<Rootstock, string> = {
  dwarf: 'Dwarf',
  semiDwarf: 'Semi-dwarf',
  standard: 'Standard',
};
/** A tree's spacing on each rootstock; null where the catalog has none. */
export type RootstockSpacingDto = Record<Rootstock, number | null>;

/** The three spacing columns as one value, or null for a plant with none. */
export function rootstockSpacing(row: {
  dwarfSpacingInches?: number | null;
  semiDwarfSpacingInches?: number | null;
  standardSpacingInches?: number | null;
}): RootstockSpacingDto | null {
  const spacing = {
    dwarf: row.dwarfSpacingInches ?? null,
    semiDwarf: row.semiDwarfSpacingInches ?? null,
    standard: row.standardSpacingInches ?? null,
  };
  return Object.values(spacing).some((v) => v !== null) ? spacing : null;
}

/** How much frost a crop survives: none, a light frost, or a hard frost. */
export type FrostTolerance = 'tender' | 'half-hardy' | 'hardy';

export interface PlantSummaryDto {
  id: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number;
  zoneMax: number;
  /** Present on list items; catalog admission requires a known value. */
  spacingInches: number;
  /** Null: clients show the crop's icon (by `cropId`) instead. */
  illustrationUrl: string | null;
  /** Trees only: spacing by rootstock, which sizes a tree's bed. */
  rootstockSpacingInches?: RootstockSpacingDto | null;
  /** Botanical family by its common name, for rotation advice. */
  family?: string | null;
  /** The dataset crop this entry belongs to; names its icon. Null outside the dataset. */
  cropId?: string | null;
}

/**
 * Temperatures a crop grows and is sown in, from the dataset. Where there is
 * no frost to anchor windows to, these place them instead (ADR 0025).
 */
export interface SowingTemperatureDto {
  /** Air temperature range for growth, °C. */
  minC: number;
  maxC: number;
  /** Soil temperature needed to sow, °C. */
  minSoilC: number | null;
}

/** The soil pH a crop grows best in, from the dataset. */
export interface SoilPhDto {
  min: number;
  max: number;
}

/**
 * Crop coefficients (Kc) from the dataset, after FAO-56: the crop uses
 * reference evapotranspiration times Kc, which rises from `initial` to `mid`
 * at full cover and falls to `end` at harvest.
 */
export interface CropCoefficientsDto {
  initial: number;
  mid: number;
  end: number;
  /** Typical days in each growth stage, where the dataset has them. */
  stageDays: { initial: number; development: number; mid: number; late: number } | null;
}

export type CompanionBenefit =
  | 'deters-pests'
  | 'trap-crop'
  | 'attracts-beneficials'
  | 'attracts-pollinators'
  | 'fixes-nitrogen'
  | 'support'
  | 'shade'
  | 'ground-cover'
  | 'competes'
  | 'suppresses-growth'
  | 'shares-pests';

export type CompanionEvidence = 'research' | 'extension' | 'traditional';

/** Where a companion pair's evidence comes from; a greenhouse has no zones. */
export interface CompanionPlaceDto {
  where: string;
  zones: { min: number; max: number } | null;
}

/** A companion pair from the dataset, seen from one crop. Advice only. */
export interface CatalogCompanionDto {
  /** The other crop's dataset id and name. */
  cropId: string;
  name: string;
  kind: 'helps' | 'hinders';
  benefits: CompanionBenefit[];
  evidence: CompanionEvidence;
  reason: string;
  reference: string | null;
  shownIn: CompanionPlaceDto[];
}

export interface PlantDetailDto extends Omit<PlantSummaryDto, 'spacingInches'> {
  sunRequirements: string | null;
  waterNeeds: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
  waterIntervalDays: number | null;
  fertilizeIntervalDays: number | null;
  status: PlantStatus;
  isFavorite: boolean;
  growingGuidance: import('./calendar').GrowingGuidanceDto;
  sowingTemperature: SowingTemperatureDto | null;
  soilPh: SoilPhDto | null;
  cropCoefficients: CropCoefficientsDto | null;
  /**
   * Companion pairs for this plant's crop, those shown nearest the member's
   * properties first (by USDA hardiness zone).
   */
  companions: CatalogCompanionDto[];
  /** The zones of the member's properties the order was ranked for. */
  companionZones: number[];
  /** The other catalog entries of the same crop (the crop itself and its varieties), A to Z. */
  varieties: PlantVarietyDto[];
}

/** A catalog entry of the same crop, with what tells it apart. */
export interface PlantVarietyDto {
  id: string;
  commonName: string;
  cultivar: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PlantListQueryDto {
  q?: string;
  zone?: number;
  plantType?: PlantType;
  /** Botanical family, as the catalog names it. */
  family?: string;
  /** A property: only crops whose sowing or planting window there is open this week. */
  sowNowFor?: string;
  /** The member's local date (YYYY-MM-DD) that "this week" starts from. */
  asOf?: string;
  page?: number;
  pageSize?: number;
}

export interface FavoriteListItemDto {
  favoriteId: string;
  plant: Omit<PlantSummaryDto, 'spacingInches'> & {
    spacingInches: number | null;
    status: PlantStatus;
  };
  createdAt: string;
  unavailable: boolean;
}

export interface FavoriteMutationDto {
  clientMutationId?: string;
}

export interface FavoriteDto {
  favoriteId: string;
  plantId: string;
  createdAt: string;
}

export interface ApiErrorDto {
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL';
    message: string;
  };
}

export const PLANT_TYPES: readonly PlantType[] = [
  'vegetable',
  'herb',
  'flower',
  'fruit',
  'cane',
  'shrub',
  'vine',
  'tree',
] as const;

/**
 * How a plant is named to people: a dataset crop and its varieties share a
 * common name ("Tomato"), so a variety carries its name ("Tomato (Cherry)").
 */
export function plantName(plant: { commonName: string; cultivar: string | null }): string {
  return plant.cultivar ? `${plant.commonName} (${plant.cultivar})` : plant.commonName;
}
