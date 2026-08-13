import type { FavoriteRepository, PlantRepository } from '@open-garden/plant-catalog-data';
import type { PlantDetailDto, PlantStatus, PlantType } from '@open-garden/shared-types';

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
    };
  }
}
