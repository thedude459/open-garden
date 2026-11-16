import type { TodayTaskDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { groupTodayTasks, localIso, nextTaskByGarden } from './today-groups';

const task = (gardenId: string, kind: TodayTaskDto['kind'], title: string): TodayTaskDto => ({
  gardenId,
  gardenName: gardenId === 'a' ? 'Home' : 'Allotment',
  kind,
  title,
  bedName: null,
});

describe('groupTodayTasks', () => {
  it('groups by property, splits care from sowing, and puts overdue first', () => {
    const groups = groupTodayTasks([
      task('a', 'dueToday', 'Water Basil'),
      task('b', 'thisWeek', 'Start Kale'),
      task('a', 'overdue', 'Harvest Radish'),
      task('a', 'thisWeek', 'Start Tomato'),
    ]);
    expect(groups.map((g) => g.gardenName)).toEqual(['Home', 'Allotment']);
    expect(groups[0]!.due.map((t) => t.title)).toEqual(['Harvest Radish', 'Water Basil']);
    expect(groups[0]!.start.map((t) => t.title)).toEqual(['Start Tomato']);
    expect(groups[1]!.due).toEqual([]);
  });

  it('formats the local day', () => {
    expect(localIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('nextTaskByGarden', () => {
  it("picks each property's most urgent task: overdue, then today, then this week", () => {
    const next = nextTaskByGarden([
      task('a', 'thisWeek', 'Sow peas'),
      task('a', 'overdue', 'Water tomato'),
      task('a', 'dueToday', 'Feed squash'),
      task('b', 'thisWeek', 'Sow kale'),
      task('b', 'thisWeek', 'Sow beans'),
    ]);
    expect(next.get('a')?.title).toBe('Water tomato');
    // Within a kind, Today's order stands.
    expect(next.get('b')?.title).toBe('Sow kale');
    expect(next.has('c')).toBe(false);
  });
});
