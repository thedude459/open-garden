import {
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  PlantingRepository,
  PlantRepository,
  TrayRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { PlantingService } from '@open-garden/seasonal-plantings';

export function openPlantingService(db: AppDatabase) {
  return new PlantingService(
    new GardenMembershipRepository(db),
    new PlantRepository(db),
    new PlantingRepository(db),
    new BedRepository(db),
    new PlantingAreaRepository(db),
    new TrayRepository(db),
  );
}
