import {
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  PlantingRepository,
  PlantRepository,
  SoilTestRepository,
  TrayRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { domainError, PlantingService, SoilTestService } from '@open-garden/seasonal-plantings';
import { soilTestCreateSchema, type SoilTestCreateDto } from '@open-garden/shared-types';

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

export function openSoilTestService(db: AppDatabase) {
  return new SoilTestService(
    new GardenMembershipRepository(db),
    new PlantingAreaRepository(db),
    new BedRepository(db),
    new SoilTestRepository(db),
  );
}

export function parseSoilTest(body: unknown): SoilTestCreateDto {
  const parsed = soilTestCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Check the soil test');
  }
  return parsed.data;
}
