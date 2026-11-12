import type { CalendarEntryDto, ReminderItemDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { todayFor, type TodaySources } from './today';

const reminder = (over: Partial<ReminderItemDto>): ReminderItemDto => ({
  plantingId: 'p1',
  kind: 'water',
  dueOn: '2026-06-01',
  urgency: 'dueToday',
  intervalDays: 7,
  plantId: 'tomato',
  commonName: 'Tomato',
  species: 'Solanum lycopersicum',
  cultivar: 'Cherry',
  plantType: 'vegetable',
  status: 'active',
  required: true,
  rainNote: null,
  bedName: 'North',
  ...over,
});

// Sowing window open all year, so "this week" is always true.
const window = { earliest: { month: 1, day: 1 }, latest: { month: 12, day: 31 }, wrapsYear: false };
const entry = (over: Partial<CalendarEntryDto>): CalendarEntryDto =>
  ({
    plantId: 'kale',
    commonName: 'Kale',
    cultivar: null,
    planted: false,
    windows: { indoorStart: null, outdoorSow: window, transplant: null, harvest: null },
    ...over,
  }) as CalendarEntryDto;

function sources(over: Partial<TodaySources> = {}): TodaySources {
  return {
    gardens: async () => [
      { id: 'a', name: 'Home', myRole: 'owner' },
      { id: 'b', name: 'Allotment', myRole: 'viewer' },
    ],
    reminders: async (gardenId) =>
      gardenId === 'a'
        ? [
            reminder({}),
            reminder({ plantingId: 'p2', kind: 'harvest', urgency: 'overdue' }),
            reminder({ plantingId: 'p3', urgency: 'upcoming' }),
            reminder({ plantingId: 'p4', required: false }),
          ]
        : [reminder({ plantingId: 'p5', bedName: null })],
    calendar: async (gardenId) =>
      gardenId === 'a' ? [entry({}), entry({ plantId: 'bean', planted: true })] : [],
    ...over,
  };
}

describe('todayFor', () => {
  it('lists due and overdue care and unplanted crops to start, per property', async () => {
    const today = await todayFor(sources(), 'u', '2026-06-01');
    expect(today.tasks.map((t) => [t.gardenName, t.kind, t.title, t.canEdit])).toEqual([
      ['Home', 'dueToday', 'Water Tomato (Cherry)', true],
      ['Home', 'overdue', 'Harvest Tomato (Cherry)', true],
      ['Home', 'thisWeek', 'Start Kale', undefined],
      ['Allotment', 'dueToday', 'Water Tomato (Cherry)', false],
    ]);
    expect(today.tasks[0]?.reminder).toEqual({
      plantingId: 'p1',
      kind: 'water',
      dueOn: '2026-06-01',
      intervalDays: 7,
    });
    expect(today.gardens).toEqual([
      { id: 'a', overdue: 1, thisWeek: 1 },
      { id: 'b', overdue: 0, thisWeek: 0 },
    ]);
  });

  it('skips a property whose reminders or calendar cannot be read', async () => {
    const fail = async () => {
      throw new Error('gone');
    };
    const today = await todayFor(sources({ reminders: fail, calendar: fail }), 'u', '2026-06-01');
    expect(today.tasks).toEqual([]);
    expect(today.gardens).toHaveLength(2);
  });
});
