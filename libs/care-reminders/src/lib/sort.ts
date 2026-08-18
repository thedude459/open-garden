import type { CareKind, ReminderItemDto, ReminderUrgency } from '@open-garden/shared-types';

const URGENCY_ORDER: Record<ReminderUrgency, number> = {
  overdue: 0,
  dueToday: 1,
  upcoming: 2,
};

const KIND_ORDER: Record<CareKind, number> = {
  harvest: 0,
  water: 1,
  fertilize: 2,
};

export function sortReminders(items: ReminderItemDto[]): ReminderItemDto[] {
  return [...items].sort((a, b) => {
    const byUrgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (byUrgency !== 0) return byUrgency;

    const byDate = a.dueOn.localeCompare(b.dueOn);
    if (byDate !== 0) return byDate;

    const byPlanting = a.plantingId.localeCompare(b.plantingId);
    if (byPlanting !== 0) return byPlanting;

    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}
