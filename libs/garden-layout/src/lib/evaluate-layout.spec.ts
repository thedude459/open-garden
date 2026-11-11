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
    expect(flags).toEqual([{ kind: 'unavailable', plantingIds: ['a'], blocking: false }]);
  });

  it('leaves leftover null-spacing plantings present (unavailable, not dropped)', () => {
    const leftover = {
      id: 'legacy',
      spacingInches: null as number | null,
      placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
    };
    const flags = evaluateLayout([bed], [leftover]);
    expect(leftover.placement).toEqual({ bedId: 'bed-1', xInches: 20, yInches: 20 });
    expect(flags).toEqual([{ kind: 'unavailable', plantingIds: ['legacy'], blocking: false }]);
  });

  it('does not compare plantings across overlapping beds', () => {
    const flags = evaluateLayout(
      [bed, { id: 'bed-2', geometry: { lengthInches: 96, widthInches: 48 } }],
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

  describe('against the saved layout', () => {
    // Saved 18 in apart when both needed 12; the catalog now says 24 for b.
    const a = {
      id: 'a',
      spacingInches: 12,
      placement: { bedId: 'bed-1', xInches: 20, yInches: 20 },
    };
    const b = {
      id: 'b',
      spacingInches: 24,
      placement: { bedId: 'bed-1', xInches: 38, yInches: 20 },
    };
    const saved = { beds: [bed], plantings: [a, b] };

    it('flags a problem the saved layout already had without blocking', () => {
      expect(evaluateLayout([bed], [a, b], saved)).toEqual([
        {
          kind: 'spacing',
          plantingIds: ['a', 'b'],
          blocking: false,
          message: 'Closer than recommended',
        },
      ]);
    });

    it('blocks once one of the plantings moves', () => {
      const moved = { ...b, placement: { ...b.placement, xInches: 36 } };
      expect(evaluateLayout([bed], [a, moved], saved)[0]?.blocking).toBe(true);
    });

    it('blocks once the bed changes size', () => {
      const smaller = { ...bed, geometry: { lengthInches: 40, widthInches: 48 } };
      expect(evaluateLayout([smaller], [a, b], saved).every((f) => f.blocking)).toBe(true);
    });

    it('blocks a new problem next to an old one', () => {
      const c = {
        id: 'c',
        spacingInches: 12,
        placement: { bedId: 'bed-1', xInches: 20, yInches: 26 },
      };
      const flags = evaluateLayout([bed], [a, b, c], saved);
      expect(flags.filter((f) => f.blocking).map((f) => f.plantingIds)).toEqual([
        ['a', 'c'],
        ['b', 'c'],
      ]);
    });

    it('keeps a saved planting past the bed edge without blocking', () => {
      const edge = {
        id: 'e',
        spacingInches: 24,
        placement: { bedId: 'bed-1', xInches: 6, yInches: 24 },
      };
      expect(evaluateLayout([bed], [edge], { beds: [bed], plantings: [edge] })).toEqual([
        {
          kind: 'fit',
          plantingIds: ['e'],
          blocking: false,
          message: 'Closer to the bed edge than recommended',
        },
      ]);
    });
  });
});
