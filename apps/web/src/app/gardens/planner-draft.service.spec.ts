import { describe, expect, it, vi } from 'vitest';
import type { GardenLayoutDto } from '@open-garden/shared-types';
import { savePlannerDraft, type PlannerSaveDeps, type PlannerSaveTracking } from './planner-save';

function layout(overrides: Partial<GardenLayoutDto> = {}): GardenLayoutDto {
  return {
    gardenId: 'g1',
    myRole: 'owner',
    beds: [
      {
        id: 'bed-new',
        name: 'East',
        geometry: {
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0,
        },
      },
    ],
    areas: [],
    plantings: [
      {
        id: 'seed-new',
        plantId: 'plant',
        commonName: 'Tomato',
        species: 'Solanum',
        cultivar: null,
        plantType: 'vegetable',
        status: 'active',
        bedId: 'bed-new',
        spacingInches: 24,
        startMethod: 'direct_seed',
        indoorStartedOn: null,
        placement: { plantingId: 'seed-new', bedId: 'bed-new', xInches: 24, yInches: 24 },
      },
    ],
    flags: [],
    ...overrides,
  };
}

function tracking(extra: Partial<PlannerSaveTracking> = {}): PlannerSaveTracking {
  return {
    newBedIds: new Set(['bed-new']),
    newDirectSeedIds: new Set(['seed-new']),
    pendingDirectSeedDeletes: new Set(['old-seed']),
    ...extra,
  };
}

function deps(overrides: Partial<PlannerSaveDeps> = {}): PlannerSaveDeps & {
  createBed: ReturnType<typeof vi.fn>;
  deleteBed: ReturnType<typeof vi.fn>;
  createPlanting: ReturnType<typeof vi.fn>;
  deletePlanting: ReturnType<typeof vi.fn>;
  putLayout: ReturnType<typeof vi.fn>;
} {
  const saved = layout({ beds: [{ id: 'bed-new', name: 'East', geometry: layout().beds[0]!.geometry }] });
  return {
    createBed: vi.fn(async () => undefined),
    deleteBed: vi.fn(async () => undefined),
    createPlanting: vi.fn(async () => undefined),
    deletePlanting: vi.fn(async () => undefined),
    putLayout: vi.fn(async () => saved),
    ...overrides,
  } as never;
}

describe('savePlannerDraft', () => {
  it('posts beds then direct seeds then PUT then pending deletes', async () => {
    const order: string[] = [];
    const d = deps({
      createBed: vi.fn(async () => {
        order.push('bed');
      }),
      createPlanting: vi.fn(async () => {
        order.push('seed');
      }),
      putLayout: vi.fn(async () => {
        order.push('put');
        return layout();
      }),
      deletePlanting: vi.fn(async () => {
        order.push('del');
      }),
    });
    const t = tracking();
    await savePlannerDraft(layout(), t, d);
    expect(order).toEqual(['bed', 'seed', 'put', 'del']);
    expect(t.newBedIds.size).toBe(0);
    expect(t.newDirectSeedIds.size).toBe(0);
    expect(t.pendingDirectSeedDeletes.size).toBe(0);
  });

  it('compensating-deletes posted beds and direct seeds when PUT fails', async () => {
    const d = deps({
      putLayout: vi.fn(async () => {
        throw new Error('PUT failed');
      }),
    });
    await expect(savePlannerDraft(layout(), tracking(), d)).rejects.toThrow('PUT failed');
    expect(d.deletePlanting).toHaveBeenCalledWith('seed-new');
    expect(d.deleteBed).toHaveBeenCalledWith('bed-new');
    expect(d.deletePlanting).not.toHaveBeenCalledWith('old-seed');
  });

  it('refuses a blocking layout before any POST', async () => {
    const crowded = layout({
      plantings: [
        layout().plantings[0]!,
        {
          ...layout().plantings[0]!,
          id: 'seed-2',
          placement: { plantingId: 'seed-2', bedId: 'bed-new', xInches: 26, yInches: 24 },
        },
      ],
    });
    const d = deps();
    await expect(savePlannerDraft(crowded, tracking(), d)).rejects.toMatchObject({
      message: 'Layout has spacing or fit problems',
    });
    expect(d.createBed).not.toHaveBeenCalled();
    expect(d.putLayout).not.toHaveBeenCalled();
  });
});
