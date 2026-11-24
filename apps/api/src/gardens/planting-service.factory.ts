import { openCalendarService } from './calendar-service.factory';
import {
  BedRepository,
  GardenMembershipRepository,
  PlantingAreaRepository,
  PlantingRepository,
  PlantRepository,
  SoilTestRepository,
  TrayRepository,
  YearRecordRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import {
  BedService,
  domainError,
  PlantingService,
  SoilTestService,
} from '@open-garden/seasonal-plantings';
import { soilTestCreateSchema, type SoilTestCreateDto } from '@open-garden/shared-types';

export function openPlantingService(db: AppDatabase) {
  const memberships = new GardenMembershipRepository(db);
  const plants = new PlantRepository(db);
  const calendar = openCalendarService(db);
  return new PlantingService(
    memberships,
    plants,
    new PlantingRepository(db),
    new BedRepository(db),
    new PlantingAreaRepository(db),
    new TrayRepository(db),
    { plan: (...args) => calendar.sowingPlanFor(...args) },
    new YearRecordRepository(db),
  );
}

export function openBedService(db: AppDatabase) {
  return new BedService(
    new GardenMembershipRepository(db),
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
