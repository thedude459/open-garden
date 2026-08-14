import type { FavoriteRepository, PlantRepository } from '@open-garden/plant-catalog-data';
import type {
  FavoriteDto,
  FavoriteListItemDto,
  PageDto,
  PlantStatus,
  PlantType,
} from '@open-garden/shared-types';

export class FavoritesService {
  constructor(
    private readonly favorites: FavoriteRepository,
    private readonly plants: PlantRepository,
  ) {}

  async list(userId: string, page = 1, pageSize = 20): Promise<PageDto<FavoriteListItemDto>> {
    const result = await this.favorites.listForUser(userId, page, pageSize);
    return {
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      items: result.items.map((row) => ({
        favoriteId: row.favoriteId,
        createdAt: toIso(row.createdAt),
        unavailable: row.plant.status === 'deprecated',
        plant: {
          id: row.plant.id,
          commonName: row.plant.commonName,
          species: row.plant.species,
          cultivar: row.plant.cultivar,
          plantType: row.plant.plantType as PlantType,
          zoneMin: row.plant.zoneMin,
          zoneMax: row.plant.zoneMax,
          status: row.plant.status as PlantStatus,
        },
      })),
    };
  }

  async add(userId: string, plantId: string, clientMutationId?: string): Promise<FavoriteDto> {
    const plant = await this.plants.getById(plantId);
    if (!plant) {
      const err = new Error('Plant not found') as Error & { code: string };
      err.code = 'NOT_FOUND';
      throw err;
    }
    const row = await this.favorites.add(userId, plantId, clientMutationId);
    if (!row) {
      throw new Error('Failed to add favorite');
    }
    return {
      favoriteId: row.id,
      plantId: row.plantId,
      createdAt: toIso(row.createdAt),
    };
  }

  async remove(userId: string, plantId: string): Promise<void> {
    await this.favorites.remove(userId, plantId);
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
