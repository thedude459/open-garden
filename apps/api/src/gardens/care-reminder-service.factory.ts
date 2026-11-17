import { CareReminderService } from '@open-garden/care-reminders';
import { waterOutlookFor, type WaterOutlook } from '@open-garden/garden-place';
import {
  CareEventRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantingRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';

/** One outlook for the process, so the reminders page, Today, and the daily send share its cache. */
let water: WaterOutlook | undefined;

/** Care reminders over the database, watering by each property's weather (ADR 0035). */
export function openCareReminderService(db: AppDatabase): CareReminderService {
  const memberships = new GardenMembershipRepository(db);
  const events = new CareEventRepository(db);
  const gardens = new GardenRepository(db);
  water ??= waterOutlookFor();
  const outlook = water;
  return new CareReminderService(
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
      remove: (plantingId, kind, occurrenceOn) =>
        events.deleteEvent(plantingId, kind, occurrenceOn),
    },
    async (gardenId, asOf) => {
      const garden = await gardens.getById(gardenId);
      if (garden?.latitude == null || garden.longitude == null) return null;
      return outlook.daily(garden.latitude, garden.longitude, asOf);
    },
  );
}
