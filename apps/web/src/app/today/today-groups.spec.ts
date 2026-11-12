import type { TodayTaskDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { groupTodayTasks, localIso } from './today-groups';

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
