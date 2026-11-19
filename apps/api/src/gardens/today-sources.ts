import { weatherAlerts } from '@open-garden/care-reminders';
import { GardenService } from '@open-garden/gardens';
import { climateLookupFor, temperatureOutlookFor } from '@open-garden/garden-place';
import {
  CalendarEntryRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantingRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { CalendarService } from '@open-garden/planting-calendar';
import type { TodaySources } from '@open-garden/reminder-delivery';
import { plantName, type FrostTolerance } from '@open-garden/shared-types';
import { openCareReminderService } from './care-reminder-service.factory';

/** Today's sources over the database: shared by the Today page and the daily reminders. */
export function todaySources(db: AppDatabase): TodaySources {
  const climate = climateLookupFor();
  const forecast = temperatureOutlookFor();
  const gardenRows = new GardenRepository(db);
  const plantings = new PlantingRepository(db);
  const memberships = new GardenMembershipRepository(db);
  const gardens = new GardenService(new GardenRepository(db), memberships, climate);
  const calendar = new CalendarService(
    new GardenRepository(db),
    memberships,
    new PlantRepository(db),
    new CalendarEntryRepository(db),
  );
  const reminders = openCareReminderService(db);
  return {
    gardens: async (userId) => (await gardens.list(userId, 1, 100)).items,
    reminders: async (gardenId, userId, asOf) =>
      (await reminders.list(gardenId, userId, asOf)).items,
    calendar: async (gardenId, userId) => (await calendar.list(userId, gardenId, 1, 200)).entries,
    // Only called for properties `gardens` listed for the member.
    weather: async (gardenId, asOf) => {
      const garden = await gardenRows.getById(gardenId);
      if (garden?.latitude == null || garden.longitude == null) return [];
      // Plants in beds still growing; trays and waiting transplants are under
      // cover, and planned ones are not in the ground yet (ADR 0040).
      const inBeds = (await plantings.listAllForReminders(gardenId)).filter(
        (p) => p.bedId != null && p.plantedOn != null && p.harvestedOn == null,
      );
      if (inBeds.length === 0) return [];
      return weatherAlerts(
        inBeds.map((p) => ({
          name: plantName(p),
          bedName: p.bedName,
          frostTolerance: isFrostTolerance(p.frostTolerance) ? p.frostTolerance : null,
          growMaxC: p.growMaxC,
        })),
        await forecast.daily(garden.latitude, garden.longitude, asOf),
        asOf,
      );
    },
  };
}

function isFrostTolerance(value: string | null): value is FrostTolerance {
  return value === 'tender' || value === 'half-hardy' || value === 'hardy';
}
