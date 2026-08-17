import { describe, expect, it } from 'vitest';
import type { ReminderItemDto } from '@open-garden/shared-types';
import { sortReminders } from './sort';

function item(
  overrides: Partial<ReminderItemDto> & { plantingId: string; kind: ReminderItemDto['kind']; dueOn: string },
): ReminderItemDto {
  return {
    urgency: 'upcoming',
    intervalDays: null,
    plantId: 'plant-1',
    commonName: 'Test',
    species: 'Test sp.',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    ...overrides,
  };
}

describe('sortReminders', () => {
  it('orders overdue oldest-first, then due today, then upcoming soonest-first', () => {
    const sorted = sortReminders([
      item({ plantingId: 'p1', kind: 'harvest', dueOn: '2026-08-20', urgency: 'upcoming' }),
      item({ plantingId: 'p2', kind: 'harvest', dueOn: '2026-08-10', urgency: 'overdue' }),
      item({ plantingId: 'p3', kind: 'water', dueOn: '2026-08-17', urgency: 'dueToday' }),
      item({ plantingId: 'p4', kind: 'harvest', dueOn: '2026-08-01', urgency: 'overdue' }),
    ]);
    expect(sorted.map((i) => i.plantingId)).toEqual(['p4', 'p2', 'p3', 'p1']);
  });

  it('ties same dueOn by plantingId then kind harvest/water/fertilize', () => {
    const sorted = sortReminders([
      item({ plantingId: 'b', kind: 'fertilize', dueOn: '2026-08-17', urgency: 'dueToday' }),
      item({ plantingId: 'a', kind: 'water', dueOn: '2026-08-17', urgency: 'dueToday' }),
      item({ plantingId: 'a', kind: 'harvest', dueOn: '2026-08-17', urgency: 'dueToday' }),
    ]);
    expect(sorted.map((i) => `${i.plantingId}:${i.kind}`)).toEqual([
      'a:harvest',
      'a:water',
      'b:fertilize',
    ]);
  });
});
