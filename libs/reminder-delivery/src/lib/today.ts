import { overlapsThisWeek } from '@open-garden/planting-calendar';
import {
  CARE_VERBS,
  plantName,
  type CalendarEntryDto,
  type GardenRole,
  type ReminderItemDto,
  type TodayDto,
} from '@open-garden/shared-types';

/** Where Today's tasks come from; the API wires these to its services. */
export interface TodaySources {
  gardens(userId: string): Promise<{ id: string; name: string; myRole: GardenRole }[]>;
  reminders(gardenId: string, userId: string, asOf: string): Promise<ReminderItemDto[]>;
  calendar(gardenId: string, userId: string): Promise<CalendarEntryDto[]>;
}

/**
 * What a member has to do on `asOf` (a `YYYY-MM-DD` day), across every
 * property: care that is overdue or due, and crops not yet planted whose
 * sowing or planting window is open this week.
 */
export async function todayFor(
  sources: TodaySources,
  userId: string,
  asOf: string,
): Promise<TodayDto> {
  const [year, month, day] = asOf.split('-').map(Number);
  const today = new Date(year!, (month ?? 1) - 1, day ?? 1);
  const tasks: TodayDto['tasks'] = [];
  const gardens: TodayDto['gardens'] = [];
  for (const garden of await sources.gardens(userId)) {
    let overdue = 0;
    let thisWeek = 0;
    try {
      for (const item of await sources.reminders(garden.id, userId, asOf)) {
        if (item.required === false) continue;
        if (item.urgency === 'overdue') overdue += 1;
        if (item.urgency !== 'overdue' && item.urgency !== 'dueToday') continue;
        tasks.push({
          gardenId: garden.id,
          gardenName: garden.name,
          kind: item.urgency,
          title: `${CARE_VERBS[item.kind]} ${plantName(item)}`,
          bedName: item.bedName ?? null,
          reminder: {
            plantingId: item.plantingId,
            kind: item.kind,
            dueOn: item.dueOn,
            intervalDays: item.intervalDays,
          },
          canEdit: garden.myRole !== 'viewer',
        });
      }
    } catch {
      /* a property the member can no longer open is skipped */
    }
    try {
      for (const entry of await sources.calendar(garden.id, userId)) {
        // A crop already in the ground is not one to start.
        if (entry.planted) continue;
        if (!overlapsThisWeek([entry.windows.outdoorSow, entry.windows.transplant], today)) {
          continue;
        }
        thisWeek += 1;
        tasks.push({
          gardenId: garden.id,
          gardenName: garden.name,
          kind: 'thisWeek',
          title: `Start ${plantName(entry)}`,
          bedName: null,
        });
      }
    } catch {
      /* calendar windows are optional here */
    }
    gardens.push({ id: garden.id, overdue, thisWeek });
  }
  return { tasks, gardens };
}
