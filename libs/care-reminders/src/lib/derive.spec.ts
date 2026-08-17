import { describe, expect, it } from 'vitest';
import { deriveReminders, type DerivePlantingInput } from './derive';

function planting(overrides: Partial<DerivePlantingInput> & { plantingId: string }): DerivePlantingInput {
  return {
    plantId: 'plant-1',
    commonName: 'Test',
    species: 'Test sp.',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    plantedOn: '2026-01-01',
    harvestedOn: null,
    daysToMaturity: 60,
    waterIntervalDays: null,
    fertilizeIntervalDays: null,
    ...overrides,
  };
}

describe('deriveReminders', () => {
  it('omits harvest without planted date or DTM', () => {
    const items = deriveReminders(
      [
        planting({ plantingId: 'a', plantedOn: null }),
        planting({ plantingId: 'b', daysToMaturity: null }),
      ],
      [],
      '2026-08-17',
    );
    expect(items).toHaveLength(0);
  });

  it('omits harvest when harvestedOn is set', () => {
    const items = deriveReminders(
      [planting({ plantingId: 'a', harvestedOn: '2026-07-01' })],
      [],
      '2026-08-17',
    );
    expect(items).toHaveLength(0);
  });

  it('lists far-future harvest', () => {
    const items = deriveReminders([planting({ plantingId: 'a' })], [], '2026-01-02');
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('harvest');
    expect(items[0]?.dueOn).toBe('2026-03-02');
    expect(items[0]?.urgency).toBe('upcoming');
  });

  it('omits qualitative water and missing fertilize intervals', () => {
    const items = deriveReminders([planting({ plantingId: 'a' })], [], '2026-08-17');
    expect(items.every((i) => i.kind === 'harvest')).toBe(true);
  });

  it('Interval Herb yields one water and one fertilize item', () => {
    const items = deriveReminders(
      [
        planting({
          plantingId: 'herb',
          commonName: 'Interval Herb',
          waterIntervalDays: 7,
          fertilizeIntervalDays: 21,
          daysToMaturity: 45,
        }),
      ],
      [],
      '2026-02-10',
    );
    const water = items.filter((i) => i.kind === 'water');
    const fertilize = items.filter((i) => i.kind === 'fertilize');
    expect(water).toHaveLength(1);
    expect(fertilize).toHaveLength(1);
  });

  it('interval boundary yields single water row not stacked overdue weeks', () => {
    const items = deriveReminders(
      [
        planting({
          plantingId: 'herb',
          waterIntervalDays: 7,
          fertilizeIntervalDays: null,
          daysToMaturity: null,
          plantedOn: '2026-01-01',
        }),
      ],
      [],
      '2026-02-05',
    );
    const water = items.filter((i) => i.kind === 'water');
    expect(water).toHaveLength(1);
    expect(water[0]?.dueOn).toBe('2026-02-05');
  });

  it('future planted date yields upcoming water on planted date', () => {
    const items = deriveReminders(
      [
        planting({
          plantingId: 'herb',
          plantedOn: '2026-09-01',
          waterIntervalDays: 7,
          daysToMaturity: null,
        }),
      ],
      [],
      '2026-08-17',
    );
    const water = items.find((i) => i.kind === 'water');
    expect(water?.dueOn).toBe('2026-09-01');
    expect(water?.urgency).toBe('upcoming');
  });

  it('two plantings of same variety yield two harvest items', () => {
    const items = deriveReminders(
      [
        planting({ plantingId: 'a' }),
        planting({ plantingId: 'b', plantId: 'plant-1' }),
      ],
      [],
      '2026-08-17',
    );
    expect(items.filter((i) => i.kind === 'harvest')).toHaveLength(2);
  });

  it('any harvest event hides harvest even when dueOn differed', () => {
    const items = deriveReminders(
      [planting({ plantingId: 'a' })],
      [{ plantingId: 'a', kind: 'harvest', occurrenceOn: '2020-01-01' }],
      '2026-08-17',
    );
    expect(items.some((i) => i.kind === 'harvest')).toBe(false);
  });

  it('water complete advances one interval using greatest cursor', () => {
    const items = deriveReminders(
      [
        planting({
          plantingId: 'herb',
          waterIntervalDays: 7,
          daysToMaturity: null,
        }),
      ],
      [
        { plantingId: 'herb', kind: 'water', occurrenceOn: '2026-01-08' },
        { plantingId: 'herb', kind: 'water', occurrenceOn: '2026-01-15' },
      ],
      '2026-01-20',
    );
    const water = items.find((i) => i.kind === 'water');
    expect(water?.dueOn).toBe('2026-01-22');
  });

  it('water dismiss advances from cursor', () => {
    const items = deriveReminders(
      [
        planting({
          plantingId: 'herb',
          waterIntervalDays: 7,
          daysToMaturity: null,
        }),
      ],
      [{ plantingId: 'herb', kind: 'water', occurrenceOn: '2026-01-08' }],
      '2026-01-09',
    );
    expect(items.find((i) => i.kind === 'water')?.dueOn).toBe('2026-01-15');
  });
});
