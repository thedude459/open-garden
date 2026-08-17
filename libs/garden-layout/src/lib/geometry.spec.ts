import { describe, expect, it } from 'vitest';
import { assertCompleteGeometry } from './geometry';

describe('assertCompleteGeometry', () => {
  it('rejects incomplete or invalid geometry', () => {
    expect(() =>
      assertCompleteGeometry({
        originXInches: 0.5,
        originYInches: 0,
        lengthInches: 10,
        widthInches: 10,
        orientation: 0,
      }),
    ).toThrow('Bed size and position are required');
    expect(() =>
      assertCompleteGeometry({
        originXInches: 0,
        originYInches: 0,
        lengthInches: 0,
        widthInches: 10,
        orientation: 0,
      }),
    ).toThrow('Bed length and width must be at least 1 inch');
    expect(() =>
      assertCompleteGeometry({
        originXInches: 0,
        originYInches: 0,
        lengthInches: 10,
        widthInches: 10,
        orientation: 45,
      }),
    ).toThrow('Bed rotation must be 0, 90, 180, or 270 degrees');
  });
});
