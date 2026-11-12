export type PlantType = 'vegetable' | 'herb' | 'flower' | 'fruit' | 'cane' | 'shrub' | 'tree';

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
  /** Null until a later art feature; clients use the CSS stand-in. */
  illustrationUrl: string | null;
  /** Trees only: spacing by rootstock, which sizes a tree's bed. */
  rootstockSpacingInches?: RootstockSpacingDto | null;
  /** Botanical family by its common name, for rotation advice. */
  family?: string | null;
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
  'tree',
] as const;

/**
 * How a plant is named to people: a dataset crop and its varieties share a
 * common name ("Tomato"), so a variety carries its name ("Tomato (Cherry)").
 */
export function plantName(plant: { commonName: string; cultivar: string | null }): string {
  return plant.cultivar ? `${plant.commonName} (${plant.cultivar})` : plant.commonName;
}
