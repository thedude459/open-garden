import { describe, expect, it } from 'vitest';
import type { LayoutBedDto } from '@open-garden/shared-types';
import { drawableBeds } from './drawable-beds';

describe('drawableBeds', () => {
  it('returns only beds with complete geometry', () => {
    const beds: LayoutBedDto[] = [
      { id: 'a', name: 'Sized', geometry: {
        originXInches: 0,
        originYInches: 0,
        lengthInches: 96,
        widthInches: 48,
        orientation: 0,
      } },
      { id: 'b', name: 'Leftover', geometry: null },
    ];
    expect(drawableBeds(beds).map((b) => b.id)).toEqual(['a']);
  });
});
