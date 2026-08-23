import { describe, expect, it } from 'vitest';
import { deriveIndoorReminders, type IndoorDerivePlantingInput } from './derive-indoor';

const base: IndoorDerivePlantingInput = {
  plantingId: 'p1',
  plantId: 'plant',
  commonName: 'Tomato',
  species: 'Solanum',
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  plantedOn: null,
  harvestedOn: null,
  daysToMaturity: 70,
  waterIntervalDays: 3,
  fertilizeIntervalDays: 14,
  startMethod: 'transplant',
  indoorStartedOn: '2026-08-01',
  placed: false,
};

describe('deriveIndoorReminders', () => {
  it('emits water and fertilize for an unplaced transplant', () => {
    const items = deriveIndoorReminders([base], [], '2026-08-21');
    expect(items.map((i) => i.kind).sort()).toEqual(['fertilize', 'water']);
    expect(items.every((i) => i.plantingId === 'p1')).toBe(true);
  });

  it('omits a kind when the catalog interval is null', () => {
    const items = deriveIndoorReminders(
      [{ ...base, fertilizeIntervalDays: null }],
      [],
      '2026-08-21',
    );
    expect(items.map((i) => i.kind)).toEqual(['water']);
  });

  it('skips direct seed and placed transplants', () => {
    expect(
      deriveIndoorReminders(
        [
          { ...base, startMethod: 'direct_seed', indoorStartedOn: null },
          { ...base, plantingId: 'p2', placed: true },
        ],
        [],
        '2026-08-21',
      ),
    ).toEqual([]);
  });
});
