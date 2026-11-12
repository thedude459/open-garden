import type { TodayTaskDto } from '@open-garden/shared-types';

export interface TodayGroup {
  gardenId: string;
  gardenName: string;
  /** Care due now: overdue first, then due today. */
  due: TodayTaskDto[];
  /** Crops whose sowing or planting window is open this week. */
  start: TodayTaskDto[];
}

/** Today's tasks by property, in the order the properties first appear. */
export function groupTodayTasks(tasks: TodayTaskDto[]): TodayGroup[] {
  const groups = new Map<string, TodayGroup>();
  for (const task of tasks) {
    let group = groups.get(task.gardenId);
    if (!group) {
      group = { gardenId: task.gardenId, gardenName: task.gardenName, due: [], start: [] };
      groups.set(task.gardenId, group);
    }
    (task.kind === 'thisWeek' ? group.start : group.due).push(task);
  }
  for (const group of groups.values()) {
    group.due.sort((a, b) => Number(b.kind === 'overdue') - Number(a.kind === 'overdue'));
  }
  return [...groups.values()];
}

/** The device's calendar day, as the API's `asOf` expects. */
export function localIso(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
