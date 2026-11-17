import type {
  BedGeometryDto,
  LayoutAreaDto,
  LayoutBedDto,
  LayoutPlantingDto,
} from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import {
  areaOutlines,
  bedAt,
  bedGridLines,
  contentRects,
  dropTargetAt,
  marginBands,
  plantableRect,
  soilSize,
} from './plan-drawing';

const geo = (over: Partial<BedGeometryDto> = {}): BedGeometryDto => ({
  originXInches: 10,
  originYInches: 20,
  lengthInches: 48,
  widthInches: 24,
  orientation: 0,
  ...over,
});
const bed = (id: string, geometry: BedGeometryDto | null): LayoutBedDto => ({
  id,
  name: id,
  geometry,
});

describe('soilSize', () => {
  it('insets 3 inches a side, and turns with the bed', () => {
    expect(soilSize(geo())).toEqual({ width: 42, height: 18 });
    expect(soilSize(geo({ orientation: 90 }))).toEqual({ width: 18, height: 42 });
  });

  it('never draws below one inch', () => {
    expect(soilSize(geo({ lengthInches: 4, widthInches: 2 }))).toEqual({ width: 1, height: 1 });
  });
});

describe('bedGridLines', () => {
  it('draws a line every foot inside the frame', () => {
    const lines = bedGridLines(geo());
    // 48 x 24: verticals at 12, 24, 36; one horizontal at 12.
    expect(lines.map((l) => l.x1)).toEqual([22, 34, 46, 13]);
    expect(lines[3]).toEqual({ x1: 13, y1: 32, x2: 55, y2: 32 });
  });

  it('a bed a foot square has no inner lines', () => {
    expect(bedGridLines(geo({ lengthInches: 12, widthInches: 12 }))).toEqual([]);
  });
});

describe('plantableRect and marginBands', () => {
  it('keeps half the spacing clear of each edge', () => {
    expect(plantableRect(geo(), 12)).toEqual({ x: 16, y: 26, w: 36, h: 12 });
    const bands = marginBands(geo(), 12);
    expect(bands).toHaveLength(4);
    const area = bands.reduce((sum, b) => sum + b.w * b.h, 0);
    expect(area).toBe(48 * 24 - 36 * 12);
  });

  it('shades the whole bed when the plant cannot fit', () => {
    expect(plantableRect(geo(), 30)).toBeNull();
    expect(marginBands(geo(), 30)).toEqual([{ x: 10, y: 20, w: 48, h: 24 }]);
  });

  it('follows the bed when it is turned', () => {
    expect(plantableRect(geo({ orientation: 90 }), 12)).toMatchObject({ w: 12, h: 36 });
  });
});

describe('contentRects', () => {
  it('covers drawable beds and walkways, skipping beds with no size', () => {
    const path: LayoutAreaDto = {
      id: 'a',
      name: 'Path',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 36,
      widthInches: 12,
    };
    expect(contentRects([bed('b', geo()), bed('x', null)], [path])).toEqual([
      { x0: 10, y0: 20, x1: 58, y1: 44 },
      { x0: 0, y0: 0, x1: 36, y1: 12 },
    ]);
  });
});

describe('bedAt', () => {
  it('finds the bed under a point, edges included', () => {
    const beds = [bed('x', null), bed('b', geo())];
    expect(bedAt(beds, 10, 20)?.id).toBe('b');
    expect(bedAt(beds, 58, 44)?.id).toBe('b');
    expect(bedAt(beds, 59, 30)).toBeNull();
  });
});

describe('dropTargetAt', () => {
  const placed = {
    id: 'p',
    placement: { plantingId: 'p', bedId: 'b', xInches: 6, yInches: 6 },
  } as LayoutPlantingDto;
  const waiting = { id: 'w', placement: null } as LayoutPlantingDto;
  const at = { x: 30, y: 30 };

  it('lands in the bed that was hit, or the bed of the planting that was hit', () => {
    const inBed = { kind: 'bed', bedId: 'b', planX: 30, planY: 30 };
    expect(dropTargetAt({ kind: 'bed', bedId: 'b' }, [], at)).toEqual(inBed);
    expect(dropTargetAt({ kind: 'bed-handle', bedId: 'b' }, [], at)).toEqual(inBed);
    expect(dropTargetAt({ kind: 'planting', plantingId: 'p' }, [placed], at)).toEqual(inBed);
  });

  it('misses on walkways, empty ground, and plantings not in a bed', () => {
    expect(dropTargetAt({ kind: 'empty' }, [], at)).toEqual({ kind: 'empty' });
    expect(dropTargetAt({ kind: 'area', areaId: 'a' }, [], at)).toEqual({ kind: 'empty' });
    expect(dropTargetAt({ kind: 'area-handle', areaId: 'a' }, [], at)).toEqual({ kind: 'empty' });
    expect(dropTargetAt({ kind: 'planting', plantingId: 'w' }, [waiting], at)).toEqual({
      kind: 'empty',
    });
  });
});

describe('areaOutlines', () => {
  const inArea = (id: string, areaId: string, g: BedGeometryDto | null): LayoutBedDto => ({
    ...bed(id, g),
    areaId,
  });
  const areas = [
    { id: 'veg', name: 'Vegetable garden' },
    { id: 'orchard', name: 'Orchard' },
    { id: 'empty', name: 'Bramble patch' },
  ];

  it('boxes each area’s beds with a margin inside the property, rotated beds by their drawn size', () => {
    const beds = [
      inArea('north', 'veg', geo({ originXInches: 0, originYInches: 0 })),
      inArea('south', 'veg', geo({ originXInches: 0, originYInches: 60, orientation: 90 })),
      inArea(
        'apple',
        'orchard',
        geo({ originXInches: 200, originYInches: 0, lengthInches: 96, widthInches: 96 }),
      ),
      inArea('unsized', 'orchard', null),
    ];
    expect(areaOutlines(beds, areas)).toEqual([
      { id: 'veg', name: 'Vegetable garden', x: 0, y: 0, w: 60, h: 120 },
      { id: 'orchard', name: 'Orchard', x: 188, y: 0, w: 120, h: 108 },
    ]);
  });

  it('draws nothing when only one area has beds', () => {
    expect(areaOutlines([inArea('north', 'veg', geo())], areas)).toEqual([]);
  });
});
