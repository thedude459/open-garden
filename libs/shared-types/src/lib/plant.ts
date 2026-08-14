export type PlantType =
  | 'vegetable'
  | 'herb'
  | 'flower'
  | 'fruit'
  | 'shrub'
  | 'tree';

export type PlantStatus = 'active' | 'deprecated';

export interface PlantSummaryDto {
  id: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number;
  zoneMax: number;
}

export interface PlantDetailDto extends PlantSummaryDto {
  sunRequirements: string | null;
  waterNeeds: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
  status: PlantStatus;
  isFavorite: boolean;
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
  plant: PlantSummaryDto & { status: PlantStatus };
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
    code:
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VALIDATION_ERROR'
      | 'CONFLICT'
      | 'INTERNAL';
    message: string;
  };
}

export const PLANT_TYPES: readonly PlantType[] = [
  'vegetable',
  'herb',
  'flower',
  'fruit',
  'shrub',
  'tree',
] as const;
