import { LayoutService } from '@open-garden/garden-layout/server';
import {
  AreaRepository,
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  PlantingRepository,
  SoilTestRepository,
  transactionOn,
  YearRecordRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';

export function openLayoutService(db: AppDatabase): LayoutService {
  return new LayoutService(
    new GardenMembershipRepository(db),
    new PlantingRepository(db),
    new BedRepository(db),
    new AreaRepository(db),
    new YearRecordRepository(db),
    new SoilTestRepository(db),
    new PlantingAreaRepository(db),
    transactionOn(db, (tx) => ({
      beds: new BedRepository(tx),
      plantings: new PlantingRepository(tx),
      areas: new AreaRepository(tx),
    })),
  );
}
