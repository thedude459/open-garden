import { describe, expect, it } from 'vitest';
import {
  areaKindFor,
  bedAreaKind,
  homeFor,
  lifeForPlant,
  mulchOrNone,
  placementRefusal,
  plantOutPatch,
  stationFor,
} from './placement';

const apple = { plantType: 'tree' };

describe('placementRefusal', () => {
  it('keeps woody plants out of vegetable gardens and trays', () => {
    for (const area of ['vegetable', 'greenhouse'] as const) {
      expect(placementRefusal(area, 'tree', [])).toBe('A tree belongs in a fruit garden');
      expect(placementRefusal(area, 'cane', [])).toBe('Cane fruit belongs in a fruit garden');
      expect(placementRefusal(area, 'shrub', [])).toBe('A fruit bush belongs in a fruit garden');
      expect(placementRefusal(area, 'vine', [])).toBe('A fruiting vine belongs in a fruit garden');
      // Herbs of any habit (thyme), and herbaceous fruit (strawberry, melon).
      expect(placementRefusal(area, 'herb', [])).toBeNull();
      expect(placementRefusal(area, 'fruit', [])).toBeNull();
    }
  });

  it('lets a fruit garden hold woody fruit and herbaceous underplanting', () => {
    for (const type of ['tree', 'cane', 'shrub', 'vine', 'herb', 'vegetable', 'fruit']) {
      expect(placementRefusal('fruit', type, [])).toBeNull();
    }
  });

  it('holds one tree in a tree bed, and any number in a row', () => {
    expect(placementRefusal('fruit', 'herb', [apple], 'tree')).toBeNull();
    expect(placementRefusal('fruit', 'cane', [apple], 'tree')).toBeNull();
    expect(placementRefusal('fruit', 'tree', [apple], 'tree')).toBe('A tree bed holds one tree');
    expect(placementRefusal('fruit', 'tree', [apple], 'berry')).toBeNull();
  });

  it("reads a bed's area from its station, and keeps a station in a fruit garden", () => {
    expect(areaKindFor('tree')).toBe('fruit');
    expect(areaKindFor('berry')).toBe('fruit');
    expect(areaKindFor(null)).toBe('vegetable');
    expect(stationFor('fruit', 'berry')).toBe('berry');
    expect(stationFor('fruit')).toBe('tree');
    expect(stationFor('vegetable', 'tree')).toBeNull();
    expect(homeFor('vine')).toBe('fruit');
    expect(homeFor('fruit')).toBe('vegetable');
  });

  it('keeps woody plants and herbaceous perennials past a season', () => {
    expect(lifeForPlant('tree')).toBe('tree');
    expect(lifeForPlant('vine')).toBe('perennial');
    expect(lifeForPlant('vegetable', null, true)).toBe('perennial');
    expect(lifeForPlant('vegetable', null, false)).toBe('annual');
    expect(lifeForPlant('vegetable', 'annual', true)).toBe('annual');
  });

  it("takes a bed's area from its area, or from its station before it is saved", () => {
    expect(bedAreaKind({ areaKind: 'vegetable', station: 'tree' })).toBe('vegetable');
    expect(bedAreaKind({ station: 'berry' })).toBe('fruit');
    expect(bedAreaKind({})).toBe('vegetable');
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
