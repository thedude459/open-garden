import { describe, expect, it } from 'vitest';
import { evaluateLayout } from './evaluate-layout';

describe('evaluateLayout', () => {
  const bed = {
    id: 'bed-1',
    geometry: { lengthInches: 96, widthInches: 48 },
  };

  it('flags center-to-center too close using the larger spacing', () => {
    const flags = evaluateLayout(
      [bed],
      [
        {
          id: 'a',
          spacingInches: 12,
          placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
        },
        {
          id: 'b',
          spacingInches: 24,
          placement: { bedId: 'bed-1', xInches: 38, yInches: 20 },
        },
      ],
    );
    expect(flags.some((f) => f.kind === 'spacing' && f.blocking)).toBe(true);
  });

  it('flags mixed 12/24 spacing when centers are 18 inches apart', () => {
    const flags = evaluateLayout(
      [bed],
      [
        {
          id: 'a',
          spacingInches: 12,
          placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
        },
        {
          id: 'b',
          spacingInches: 24,
          placement: { bedId: 'bed-1', xInches: 38, yInches: 20 },
        },
      ],
    );
    expect(flags.some((f) => f.kind === 'spacing' && f.blocking)).toBe(true);
  });

  it('does not flag when centers are at least the larger spacing apart', () => {
    const flags = evaluateLayout(
      [bed],
      [
        {
          id: 'a',
          spacingInches: 12,
          placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
        },
        {
          id: 'b',
          spacingInches: 24,
          placement: { bedId: 'bed-1', xInches: 44, yInches: 20 },
        },
      ],
    );
    expect(flags.filter((f) => f.kind === 'spacing')).toHaveLength(0);
  });

  it('marks unavailable spacing as non-blocking and does not invent a pair distance', () => {
    const flags = evaluateLayout(
      [bed],
      [
        {
          id: 'a',
          spacingInches: null,
          placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
        },
        {
          id: 'b',
          spacingInches: 24,
          placement: { bedId: 'bed-1', xInches: 21, yInches: 20 },
        },
      ],
    );
    expect(flags).toEqual([
      { kind: 'unavailable', plantingIds: ['a'], blocking: false },
    ]);
  });

  it('does not compare plantings across overlapping beds', () => {
    const flags = evaluateLayout(
      [
        bed,
        { id: 'bed-2', geometry: { lengthInches: 96, widthInches: 48 } },
      ],
      [
        {
          id: 'a',
          spacingInches: 24,
          placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
        },
        {
          id: 'b',
          spacingInches: 24,
          placement: { bedId: 'bed-2', xInches: 20, yInches: 20 },
        },
      ],
    );
    expect(flags.filter((f) => f.kind === 'spacing')).toHaveLength(0);
  });

  it('still evaluates deprecated plantings for fit', () => {
    const flags = evaluateLayout(
      [{ id: 'bed-1', geometry: { lengthInches: 20, widthInches: 20 } }],
      [
        {
          id: 'maple',
          spacingInches: 36,
          placement: { bedId: 'bed-1', xInches: 10, yInches: 10 },
        },
      ],
    );
    expect(flags.some((f) => f.kind === 'fit' && f.blocking)).toBe(true);
  });
});
