import { describe, expect, it } from 'vitest';
import {
  allowsPlant,
  areaKindFor,
  lifeForPlant,
  mulchOrNone,
  placementRefusal,
  plantOutPatch,
} from './placement';

const apple = { plantType: 'tree' };

describe('placementRefusal', () => {
  it('keeps trees, canes, and fruit bushes out of vegetable gardens and trays', () => {
    for (const area of ['vegetable', 'greenhouse'] as const) {
      expect(placementRefusal(area, 'tree', [])).toBe('A tree belongs in an orchard');
      expect(placementRefusal(area, 'cane', [])).toBe('Cane fruit belongs in a bramble patch');
      expect(placementRefusal(area, 'shrub', [])).toBe('A fruit bush belongs in a bramble patch');
      // Herbs of any habit (thyme), and fruit that is not a tree, bush, or cane.
      expect(placementRefusal(area, 'herb', [])).toBeNull();
      expect(placementRefusal(area, 'fruit', [])).toBeNull();
    }
  });

  it('lets an orchard bed hold one tree and herbaceous underplanting', () => {
    expect(placementRefusal('orchard', 'tree', [])).toBeNull();
    expect(placementRefusal('orchard', 'herb', [apple])).toBeNull();
    expect(placementRefusal('orchard', 'vegetable', [apple])).toBeNull();
    expect(placementRefusal('orchard', 'tree', [apple])).toBe('A tree bed holds one tree');
    expect(placementRefusal('orchard', 'cane', [apple])).toBe(
      'Cane fruit belongs in a bramble patch',
    );
  });

  it('lets a bramble patch hold canes and fruit bushes only', () => {
    expect(placementRefusal('bramble', 'cane', [{ plantType: 'cane' }])).toBeNull();
    expect(placementRefusal('bramble', 'shrub', [])).toBeNull();
    expect(placementRefusal('bramble', 'tree', [])).toBe('A tree belongs in an orchard');
    expect(placementRefusal('bramble', 'vegetable', [])).toBe(
      'This plant belongs in a vegetable garden',
    );
  });

  it("reads a bed's area from its station", () => {
    expect(areaKindFor('tree')).toBe('orchard');
    expect(areaKindFor('berry')).toBe('bramble');
    expect(areaKindFor(null)).toBe('vegetable');
    expect(allowsPlant(areaKindFor('berry'), 'cane')).toBe(true);
    expect(allowsPlant(areaKindFor(undefined), 'cane')).toBe(false);
  });

  it('moves a tray start onto a bed', () => {
    expect(plantOutPatch('bed-1')).toEqual({ bedId: 'bed-1', trayId: null });
  });

  it('round-trips mulch, including none', () => {
    expect(mulchOrNone('none')).toBe('none');
    expect(mulchOrNone('paper')).toBe('paper');
    expect(mulchOrNone('wood_chips')).toBe('wood_chips');
    expect(mulchOrNone(undefined)).toBe('none');
    expect(mulchOrNone('hay')).toBe('none');
  });

  it('defaults canes and bushes to perennial, a tree to tree, and the rest to annual', () => {
    expect(lifeForPlant('shrub', undefined)).toBe('perennial');
    expect(lifeForPlant('cane', undefined)).toBe('perennial');
    expect(lifeForPlant('tree', undefined)).toBe('tree');
    expect(lifeForPlant('herb', undefined)).toBe('annual');
    expect(lifeForPlant('shrub', 'annual')).toBe('annual');
  });
});
