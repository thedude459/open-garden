import { describe, expect, it } from 'vitest';
import type { LayoutBedDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { classifyGesture, hitTestPlan, isClickNotDrag } from './hit-test';

const bed: LayoutBedDto = {
  id: 'bed-1',
  name: 'East',
  geometry: {
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
    orientation: 0,
  },
};

const planting: LayoutPlantingDto = {
  id: 'p1',
  plantId: 'plant',
  commonName: 'Tomato',
  species: 'Solanum',
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  bedId: 'bed-1',
  spacingInches: 24,
  startMethod: 'direct_seed',
  indoorStartedOn: null,
  placement: { plantingId: 'p1', bedId: 'bed-1', xInches: 20, yInches: 20 },
};

describe('hitTestPlan', () => {
  it('hits a planting footprint before the bed body', () => {
    expect(hitTestPlan([bed], [planting], 20, 20, 8)).toEqual({
      kind: 'planting',
      plantingId: 'p1',
    });
  });

  it('hits the bed, not the mark, when includePlantings is false', () => {
    expect(hitTestPlan([bed], [planting], 20, 20, 8, [], false)).toEqual({
      kind: 'bed',
      bedId: 'bed-1',
    });
  });

  it('hits the southeast resize handle before the bed body', () => {
    expect(hitTestPlan([bed], [], 95, 47, 8)).toEqual({
      kind: 'bed-handle',
      bedId: 'bed-1',
    });
  });

  it('hits the bed body when not on a planting or handle', () => {
    expect(hitTestPlan([bed], [planting], 80, 10, 8)).toEqual({
      kind: 'bed',
      bedId: 'bed-1',
    });
  });

  it('returns empty outside beds', () => {
    expect(hitTestPlan([bed], [planting], 200, 200, 8)).toEqual({ kind: 'empty' });
  });

  it('hits area handle, then area body, then bed handle, then bed', () => {
    const area = {
      id: 'path',
      name: 'Path',
      originXInches: 90,
      originYInches: 40,
      lengthInches: 24,
      widthInches: 16,
    };
    expect(hitTestPlan([bed], [], 113, 55, 8, [area])).toEqual({
      kind: 'area-handle',
      areaId: 'path',
    });
    expect(hitTestPlan([bed], [], 100, 48, 8, [area])).toEqual({
      kind: 'area',
      areaId: 'path',
    });
    expect(hitTestPlan([bed], [], 95, 47, 8, [])).toEqual({
      kind: 'bed-handle',
      bedId: 'bed-1',
    });
    expect(hitTestPlan([bed], [], 10, 10, 8, [area])).toEqual({
      kind: 'bed',
      bedId: 'bed-1',
    });
  });
});

describe('classifyGesture', () => {
  it('pans when the gesture starts on empty space', () => {
    expect(classifyGesture({ kind: 'empty' })).toBe('pan');
  });

  it('moves a planting when the gesture starts on a planting', () => {
    expect(classifyGesture({ kind: 'planting', plantingId: 'p1' })).toBe('move-planting');
  });

  it('moves or resizes a bed from body and handle hits', () => {
    expect(classifyGesture({ kind: 'bed', bedId: 'bed-1' })).toBe('move-bed');
    expect(classifyGesture({ kind: 'bed-handle', bedId: 'bed-1' })).toBe('resize-bed');
  });

  it('moves or resizes an area from body and handle hits', () => {
    expect(classifyGesture({ kind: 'area', areaId: 'path' })).toBe('move-area');
    expect(classifyGesture({ kind: 'area-handle', areaId: 'path' })).toBe('resize-area');
  });
});

describe('isClickNotDrag', () => {
  it('treats a small move as a click so Overview can open Bed View', () => {
    expect(isClickNotDrag(10, 10, 12, 11)).toBe(true);
    expect(isClickNotDrag(10, 10, 20, 20)).toBe(false);
  });
});
