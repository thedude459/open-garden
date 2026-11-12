import { describe, expect, it } from 'vitest';
import { localToPlan } from './rotate';
import { sizeTreeBed, treeSpacingInches } from './tree-bed';

const apple = {
  spacingInches: 165,
  rootstockSpacingInches: { dwarf: 94, semiDwarf: 165, standard: 295 },
};

describe('tree beds sized by rootstock', () => {
  it('picks the rootstock spacing and falls back to the catalog spacing', () => {
    expect(treeSpacingInches(apple, 'dwarf')).toBe(94);
    expect(treeSpacingInches(apple, 'standard')).toBe(295);
    expect(treeSpacingInches({ spacingInches: 120 }, 'dwarf')).toBe(120);
  });

  it('resizes around the center in whole feet and keeps plantings in place', () => {
    const bed = {
      originXInches: 0,
      originYInches: 0,
      lengthInches: 96,
      widthInches: 96,
      orientation: 90 as const,
    };
    const sized = sizeTreeBed(bed, 165);
    expect(sized.spacingFeet).toBe(14);
    expect(sized.geometry).toMatchObject({
      lengthInches: 168,
      widthInches: 168,
      originXInches: -36,
      originYInches: -36,
    });
    // An herb at (20, 30) in the old bed is at the same plan point after.
    const before = localToPlan(bed, 20, 30);
    const after = localToPlan(sized.geometry, 20 + sized.shiftX, 30 + sized.shiftY);
    expect(after).toEqual(before);
  });
});
