import { CalendarService } from '@open-garden/planting-calendar';
import {
  CalendarEntryRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantingAreaRepository,
  PlantRepository,
  YearRecordRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';

/**
 * The one way the API builds a calendar, so the Calendar page, Today, the
 * plant pages, and succession planting all see the same season and areas.
 */
export function openCalendarService(db: AppDatabase): CalendarService {
  return new CalendarService(
    new GardenRepository(db),
    new GardenMembershipRepository(db),
    new PlantRepository(db),
    new CalendarEntryRepository(db),
    new PlantingAreaRepository(db),
    new YearRecordRepository(db),
  );
}
