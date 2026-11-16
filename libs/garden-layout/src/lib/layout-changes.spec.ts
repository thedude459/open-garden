import type { GardenLayoutDto, LayoutPlantingDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { hasLayoutChanges, layoutChanges, layoutPutBody, restoreLayout } from './layout-changes';

const geometry = {
  originXInches: 0,
  originYInches: 0,
  lengthInches: 96,
  widthInches: 48,
  orientation: 0 as const,
};

const planting = (
  id: string,
  startMethod: LayoutPlantingDto['startMethod'],
  bedId: string | null = 'b1',
): LayoutPlantingDto => ({
  id,
  plantId: id,
  commonName: id,
  species: id,
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  bedId,
  spacingInches: 12,
  startMethod,
  indoorStartedOn: null,
  placement: bedId ? { plantingId: id, bedId, xInches: 12, yInches: 12 } : null,
});

const saved: GardenLayoutDto = {
  gardenId: 'g1',
  myRole: 'owner',
  beds: [{ id: 'b1', name: 'North', geometry }],
  areas: [],
  plantings: [planting('basil', 'direct_seed'), planting('tomato', 'transplant')],
  flags: [],
};

describe('layoutChanges', () => {
  it('finds nothing to save in an unchanged layout', () => {
    const changes = layoutChanges(saved, structuredClone(saved));
    expect(hasLayoutChanges(changes)).toBe(false);
  });

  it('creates beds and direct seeds the saved layout does not have', () => {
    const draft = {
      ...saved,
      beds: [...saved.beds, { id: 'b2', name: 'South', geometry }],
      plantings: [...saved.plantings, planting('kale', 'direct_seed', 'b2')],
    };
    const changes = layoutChanges(saved, draft);
    expect(changes.newBeds.map((b) => b.id)).toEqual(['b2']);
    expect(changes.newDirectSeeds.map((p) => p.id)).toEqual(['kale']);
    expect(changes.removedDirectSeedIds).toEqual([]);
    expect(changes.layoutChanged).toBe(true);
  });

  it('deletes a removed direct seed, but only unplaces a transplant', () => {
    const draft = {
      ...saved,
      plantings: [{ ...planting('tomato', 'transplant'), bedId: null, placement: null }],
    };
    const changes = layoutChanges(saved, draft);
    expect(changes.removedDirectSeedIds).toEqual(['basil']);
    expect(changes.newDirectSeeds).toEqual([]);
    expect(changes.layoutChanged).toBe(true);
  });

  it('never creates a waiting transplant pulled into the draft', () => {
    const draft = {
      ...saved,
      plantings: [...saved.plantings, planting('pepper', 'transplant', null)],
    };
    expect(hasLayoutChanges(layoutChanges(saved, draft))).toBe(false);
  });

  it('notices a moved bed and a new walkway', () => {
    const moved = {
      ...saved,
      beds: [{ ...saved.beds[0]!, geometry: { ...geometry, originXInches: 6 } }],
    };
    expect(layoutChanges(saved, moved).layoutChanged).toBe(true);
    const path = {
      id: 'a1',
      name: 'Path',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 48,
      widthInches: 24,
    };
    expect(layoutChanges(saved, { ...saved, areas: [path] }).layoutChanged).toBe(true);
  });

  it('ignores a rename, which is saved on its own', () => {
    const renamed = { ...saved, beds: [{ ...saved.beds[0]!, name: 'Herbs' }] };
    expect(hasLayoutChanges(layoutChanges(saved, renamed))).toBe(false);
  });
});

describe('layoutChanges after an undo', () => {
  it('deletes a saved bed the draft no longer has', () => {
    const draft = { ...saved, beds: [], plantings: [] };
    const changes = layoutChanges(saved, draft);
    expect(changes.removedBedIds).toEqual(['b1']);
    expect(changes.removedDirectSeedIds).toEqual(['basil']);
    expect(hasLayoutChanges(changes)).toBe(true);
  });
});

describe('restoreLayout', () => {
  it('brings back earlier shapes and plants but keeps current bed names', () => {
    const earlier = {
      ...saved,
      beds: [{ ...saved.beds[0]!, geometry: { ...geometry, originXInches: 24 } }],
    };
    const current = {
      ...saved,
      beds: [{ ...saved.beds[0]!, name: 'Herbs', mulch: 'straw' as const }],
    };
    const restored = restoreLayout(current, earlier);
    expect(restored.beds[0]).toMatchObject({
      name: 'Herbs',
      mulch: 'straw',
      geometry: { originXInches: 24 },
    });
    expect(restored.plantings).toBe(earlier.plantings);
  });

  it('keeps an earlier bed that is gone now, as it was', () => {
    const earlier = { ...saved, beds: [...saved.beds, { id: 'b2', name: 'South', geometry }] };
    expect(restoreLayout(saved, earlier).beds.map((b) => b.name)).toEqual(['North', 'South']);
  });
});

describe('layoutPutBody', () => {
  it('sends sized beds, walkways, and placed plantings only', () => {
    const body = layoutPutBody({
      ...saved,
      beds: [...saved.beds, { id: 'x', name: 'X', geometry: null }],
    });
    expect(body.beds.map((b) => b.id)).toEqual(['b1']);
    expect(body.placements.map((p) => p.plantingId)).toEqual(['basil', 'tomato']);
  });
});
