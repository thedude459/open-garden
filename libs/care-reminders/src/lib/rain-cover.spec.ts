import { describe, expect, it } from 'vitest';
import type { ReminderItemDto } from '@open-garden/shared-types';
import { applyRainCover, RAIN_NOTE } from './rain-cover';
import { sortReminders } from './sort';

function item(
  kind: ReminderItemDto['kind'],
  dueOn: string,
  plantingId = 'p1',
): ReminderItemDto {
  return {
    plantingId,
    kind,
    dueOn,
    urgency: 'dueToday',
    intervalDays: kind === 'harvest' ? null : 7,
    plantId: 'plant',
    commonName: 'Tomato',
    species: 'Solanum',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    required: true,
    rainNote: null,
  };
}

describe('applyRainCover', () => {
  const rows = [
    item('harvest', '2026-10-03', 'a'),
    item('water', '2026-10-03', 'a'),
    item('water', '2026-10-04', 'a'),
    item('fertilize', '2026-10-03', 'a'),
    item('water', '2026-10-03', 'b'),
  ];

  it('covers only watering on a day with at least 2.5 mm and keeps the row order', () => {
    const covered = applyRainCover(rows, { '2026-10-03': 2.5, '2026-10-04': 2.4 });
    expect(covered.map((row) => row.kind)).toEqual(rows.map((row) => row.kind));
    expect(covered[1]).toMatchObject({ required: false, rainNote: RAIN_NOTE });
    expect(covered[4]).toMatchObject({ required: false, rainNote: RAIN_NOTE });
    expect(covered[2]).toMatchObject({ required: true, rainNote: null });
    expect(covered[0]).toMatchObject({ required: true, rainNote: null });
    expect(covered[3]).toMatchObject({ required: true, rainNote: null });
    expect(sortReminders(covered).map((row) => `${row.plantingId}:${row.kind}:${row.dueOn}`)).toEqual(
      sortReminders(rows).map((row) => `${row.plantingId}:${row.kind}:${row.dueOn}`),
    );
  });

  it('leaves watering required when the day is missing or the forecast was not read', () => {
    expect(applyRainCover([item('water', '2026-10-03')], {})[0]).toMatchObject({
      required: true,
      rainNote: null,
    });
    expect(applyRainCover([item('water', '2026-10-03')], null)[0]).toMatchObject({
      required: true,
      rainNote: null,
    });
  });
});
