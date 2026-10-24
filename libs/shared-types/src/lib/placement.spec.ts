import { describe, expect, it } from 'vitest';
import {
  lifeForPlant,
  mulchOrNone,
  placementRefusal,
  plantOutPatch,
} from './placement';

const herb = { plantId: 'herb', plantType: 'herb' };
const apple = { plantId: 'apple', plantType: 'tree' };
const pear = { plantId: 'pear', plantType: 'tree' };
const blue = { plantId: 'blue', plantType: 'shrub' };
const rasp = { plantId: 'rasp', plantType: 'shrub' };

describe('placementRefusal', () => {
  it('refuses a tree in a vegetable bed, a berry bed, and a tray', () => {
    expect(placementRefusal('vegetable', null, 'tree', [], apple.plantId)).toBeTruthy();
    expect(placementRefusal('orchard', 'berry', 'tree', [], apple.plantId)).toBeTruthy();
    expect(placementRefusal('greenhouse', null, 'tree', [], apple.plantId)).toBeTruthy();
  });

  it('lets a tree bed hold one tree and an herb', () => {
    expect(placementRefusal('orchard', 'tree', 'tree', [], apple.plantId)).toBeNull();
    expect(placementRefusal('orchard', 'tree', 'herb', [apple], herb.plantId)).toBeNull();
    expect(placementRefusal('orchard', 'tree', 'tree', [apple], pear.plantId)).toBe(
      'A tree bed holds one tree',
    );
  });

  it('lets a berry bed hold many plants of one shrub and refuses a second shrub', () => {
    expect(placementRefusal('orchard', 'berry', 'shrub', [blue], blue.plantId)).toBeNull();
    expect(placementRefusal('orchard', 'berry', 'shrub', [blue, blue], blue.plantId)).toBeNull();
    expect(placementRefusal('orchard', 'berry', 'shrub', [blue], rasp.plantId)).toBe(
      'A berry bed holds one kind of shrub',
    );
    expect(placementRefusal('orchard', 'berry', 'herb', [blue], herb.plantId)).toBeNull();
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

  it('defaults an orchard shrub to perennial and a tree to tree', () => {
    expect(lifeForPlant('shrub', 'berry', undefined)).toBe('perennial');
    expect(lifeForPlant('shrub', null, undefined)).toBe('annual');
    expect(lifeForPlant('tree', 'tree', undefined)).toBe('tree');
    expect(lifeForPlant('shrub', 'berry', 'annual')).toBe('annual');
  });
});
