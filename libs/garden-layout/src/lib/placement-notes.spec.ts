import { describe, expect, it } from 'vitest';
import { placementNotes, spacingInchesFor, sunDisagrees } from './placement-notes';

describe('placement notes', () => {
  it('flags full sun against shade and still allows the placement', () => {
    expect(sunDisagrees('full sun', 'shade')).toBe(true);
    expect(sunDisagrees('part sun', 'shade')).toBe(false);
    expect(sunDisagrees('full', null)).toBe(false);
    const flags = placementNotes({
      beds: [{ id: 'bed', sun: 'shade' }],
      plantings: [
        {
          id: 'p1',
          plantId: 'tomato',
          commonName: 'Tomato',
          sunRequirements: 'full sun',
          spacingInches: 24,
          placement: { bedId: 'bed' },
        },
      ],
    });
    expect(flags).toEqual([
      expect.objectContaining({ kind: 'sun', blocking: false, message: expect.stringContaining('Tomato') }),
    ]);
  });

  it('notes a repeat and a companion without blocking save', () => {
    const flags = placementNotes({
      beds: [{ id: 'bed', sun: 'full' }],
      plantings: [
        {
          id: 'p1',
          plantId: 'tomato',
          commonName: 'Tomato',
          sunRequirements: 'full sun',
          spacingInches: 24,
          placement: { bedId: 'bed' },
        },
        {
          id: 'p2',
          plantId: 'basil',
          commonName: 'Basil',
          sunRequirements: 'full sun',
          spacingInches: 12,
          placement: { bedId: 'bed' },
        },
      ],
      priorCrops: [{ bedId: 'bed', plantId: 'tomato', commonName: 'Tomato' }],
      pairs: [
        {
          id: 'pair',
          plantId: 'basil',
          otherPlantId: 'tomato',
          plantName: 'Basil',
          otherName: 'Tomato',
          kind: 'helps',
          reason: 'scent',
        },
      ],
    });
    expect(flags.map((flag) => flag.kind).sort()).toEqual(['companion', 'repeat']);
    expect(flags.every((flag) => flag.blocking === false)).toBe(true);
    expect(flags.find((flag) => flag.kind === 'companion')?.message).toBe('Basil helps Tomato — scent');
  });

  it('uses foot spacing for a tree and catalog inches otherwise', () => {
    expect(spacingInchesFor(10, 18)).toBe(120);
    expect(spacingInchesFor(null, 18)).toBe(18);
  });
});
