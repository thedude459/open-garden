import { describe, expect, it } from 'vitest';
import { deriveReminders, type DerivePlantingInput } from './derive';

function planting(
  overrides: Partial<DerivePlantingInput> & { plantingId: string },
): DerivePlantingInput {
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
      [planting({ plantingId: 'a' }), planting({ plantingId: 'b', plantId: 'plant-1' })],
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

describe('deriveReminders: watering by water balance', () => {
  const kc = { initial: 0.6, mid: 1.15, end: 0.8, stageDays: null };
  const inBed = planting({
    plantingId: 'w',
    plantedOn: '2026-06-01',
    daysToMaturity: null,
    waterIntervalDays: 3,
    bedId: 'b1',
    water: { kc, annual: true, factor: 1 },
  });
  // Kc 1.15 (no stage lengths), ET₀ 5 mm: 5.75 mm a day, 28.75 mm on day 5.
  const weather: Record<string, { et0Mm: number; rainMm: number }> = {};
  for (let d = 1; d <= 20; d++) {
    weather[`2026-06-${String(d).padStart(2, '0')}`] = { et0Mm: 5, rainMm: 0 };
  }
  const water = (items: ReturnType<typeof deriveReminders>) =>
    items.filter((i) => i.kind === 'water');

  it('is due when the deficit reaches the threshold, with no fixed interval', () => {
    expect(water(deriveReminders([inBed], [], '2026-06-08', weather))).toEqual([
      expect.objectContaining({
        dueOn: '2026-06-06',
        urgency: 'overdue',
        intervalDays: null,
        deficitMm: 29,
      }),
    ]);
  });

  it('starts again from the day the member watered', () => {
    const events = [
      {
        plantingId: 'w',
        kind: 'water' as const,
        occurrenceOn: '2026-06-06',
        recordedOn: '2026-06-08',
      },
    ];
    expect(water(deriveReminders([inBed], events, '2026-06-08', weather))[0]).toMatchObject({
      dueOn: '2026-06-13',
      urgency: 'upcoming',
    });
  });

  it('shows nothing when no watering is due through the forecast', () => {
    const wet = { ...weather, '2026-06-04': { et0Mm: 5, rainMm: 30 } };
    const shortForecast = Object.fromEntries(
      Object.entries(wet).filter(([day]) => day <= '2026-06-07'),
    );
    expect(water(deriveReminders([inBed], [], '2026-06-05', shortForecast))).toEqual([]);
  });

  it('falls back to the fixed interval without weather, out of a bed, or once harvested', () => {
    expect(water(deriveReminders([inBed], [], '2026-06-08'))[0]).toMatchObject({ intervalDays: 3 });
    expect(
      water(deriveReminders([{ ...inBed, water: null }], [], '2026-06-08', weather))[0],
    ).toMatchObject({ intervalDays: 3 });
    expect(
      water(
        deriveReminders([{ ...inBed, harvestedOn: '2026-06-07' }], [], '2026-06-08', weather),
      )[0],
    ).toMatchObject({ intervalDays: 3 });
  });
});
