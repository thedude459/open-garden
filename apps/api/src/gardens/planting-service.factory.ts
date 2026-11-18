import { CalendarService } from '@open-garden/planting-calendar';
import {
  BedRepository,
  CalendarEntryRepository,
  GardenMembershipRepository,
  GardenRepository,
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
  const memberships = new GardenMembershipRepository(db);
  const plants = new PlantRepository(db);
  const calendar = new CalendarService(
    new GardenRepository(db),
    memberships,
    plants,
    new CalendarEntryRepository(db),
  );
  return new PlantingService(
    memberships,
    plants,
    new PlantingRepository(db),
    new BedRepository(db),
    new PlantingAreaRepository(db),
    new TrayRepository(db),
    { plan: (...args) => calendar.sowingPlanFor(...args) },
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
