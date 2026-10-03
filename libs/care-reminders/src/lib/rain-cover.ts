import type { ReminderItemDto } from '@open-garden/shared-types';

export const RAIN_NOTE = "Rain expected — you don't need to water.";
const RAIN_MM = 2.5;

export function applyRainCover(
  items: ReminderItemDto[],
  rainByDate: Record<string, number> | null,
): ReminderItemDto[] {
  return items.map((item) => {
    if (item.kind !== 'water') {
      return { ...item, required: true, rainNote: null };
    }
    const mm = rainByDate?.[item.dueOn];
    if (mm != null && mm >= RAIN_MM) {
      return { ...item, required: false, rainNote: RAIN_NOTE };
    }
    return { ...item, required: true, rainNote: null };
  });
}
