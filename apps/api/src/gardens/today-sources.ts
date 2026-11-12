import { CareReminderService } from '@open-garden/care-reminders';
import { GardenService } from '@open-garden/gardens';
import { FixtureClimateLookup, LiveClimateLookup } from '@open-garden/garden-place';
import {
  CalendarEntryRepository,
  CareEventRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantingRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { CalendarService } from '@open-garden/planting-calendar';
import type { TodaySources } from '@open-garden/reminder-delivery';

/** Today's sources over the database: shared by the Today page and the daily reminders. */
export function todaySources(db: AppDatabase): TodaySources {
  const climate =
    process.env['PLACE_PROVIDER'] === 'live' ? new LiveClimateLookup() : new FixtureClimateLookup();
  const memberships = new GardenMembershipRepository(db);
  const events = new CareEventRepository(db);
  const gardens = new GardenService(new GardenRepository(db), memberships, climate);
  const calendar = new CalendarService(
    new GardenRepository(db),
    memberships,
    new PlantRepository(db),
    new CalendarEntryRepository(db),
  );
  const reminders = new CareReminderService(
    {
      getMembership: async (gardenId, userId) => {
        const row = await memberships.get(gardenId, userId);
        return row ? { role: row.role } : null;
      },
    },
    new PlantingRepository(db),
    {
      listForGarden: (gardenId) => events.listForGarden(gardenId),
      upsert: (plantingId, kind, occurrenceOn, action) =>
        events.upsertEvent(plantingId, kind, occurrenceOn, action),
    },
  );
  return {
    gardens: async (userId) => (await gardens.list(userId, 1, 100)).items,
    reminders: async (gardenId, userId, asOf) =>
      (await reminders.list(gardenId, userId, asOf)).items,
    calendar: async (gardenId, userId) => (await calendar.list(userId, gardenId, 1, 200)).entries,
  };
}
