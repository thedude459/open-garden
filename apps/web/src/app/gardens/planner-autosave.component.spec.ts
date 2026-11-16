import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { GardenLayoutDto, LayoutPlantingDto, LayoutPutDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { LayoutApiService } from './layout-api.service';
import { PlannerDraftService } from './planner-draft.service';
import { PlantingsApiService } from './plantings-api.service';

const geometry = {
  originXInches: 0,
  originYInches: 0,
  lengthInches: 96,
  widthInches: 48,
  orientation: 0 as const,
};

const seed = (id: string, xInches: number): LayoutPlantingDto => ({
  id,
  plantId: id,
  commonName: id,
  species: id,
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  bedId: 'b1',
  spacingInches: 12,
  startMethod: 'direct_seed',
  indoorStartedOn: null,
  placement: { plantingId: id, bedId: 'b1', xInches, yInches: 12 },
});

const start = (): GardenLayoutDto => ({
  gardenId: 'g1',
  myRole: 'owner',
  beds: [{ id: 'b1', name: 'North', geometry }],
  areas: [],
  plantings: [seed('basil', 12)],
  flags: [],
});

let planner: PlannerDraftService;

/** Answers each PUT with the draft it was sent, as the API stores it. */
function setup(over: { put?: (body: LayoutPutDto) => Promise<void> } = {}) {
  const layoutApi = {
    put: vi.fn(async (_g: string, body: LayoutPutDto) => {
      const sent = planner.draft()!;
      await over.put?.(body);
      return sent;
    }),
    createBed: vi.fn(async () => undefined),
    deleteBed: vi.fn(async () => undefined),
  };
  const plantingsApi = {
    create: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: LayoutApiService, useValue: layoutApi },
      { provide: PlantingsApiService, useValue: plantingsApi },
    ],
  });
  planner = TestBed.inject(PlannerDraftService);
  planner.autosaveDelayMs = 10;
  planner.gardenId = 'g1';
  planner.hydrate(start());
  /** An edit as a page makes it. */
  const edit = (change: (l: GardenLayoutDto) => GardenLayoutDto) =>
    planner.edit(change(planner.draft()!));
  const saved = () => vi.waitFor(() => expect(planner.status()).toBe('saved'));
  return { planner, layoutApi, plantingsApi, edit, saved };
}

const moveBasil = (x: number) => (l: GardenLayoutDto) => ({
  ...l,
  plantings: l.plantings.map((p) => (p.id === 'basil' ? seed('basil', x) : p)),
});

describe('PlannerDraftService autosave', () => {
  it('saves an edit shortly after it, then reports all saved', async () => {
    const { planner, layoutApi, edit, saved } = setup();
    edit(moveBasil(30));
    expect(planner.status()).toBe('pending');
    await saved();
    expect(layoutApi.put).toHaveBeenCalledTimes(1);
    expect(planner.dirty()).toBe(false);
    expect(planner.canUndo()).toBe(true);
  });

  it('treats quick edits as one save and one undo step', async () => {
    const { planner, layoutApi, edit, saved } = setup();
    edit(moveBasil(20));
    edit(moveBasil(30));
    await saved();
    expect(layoutApi.put).toHaveBeenCalledTimes(1);
    planner.undo();
    expect(planner.draft()!.plantings[0]!.placement!.xInches).toBe(12);
    expect(planner.canUndo()).toBe(false);
  });

  it('undo saves the earlier layout, keeping the bed’s current name', async () => {
    const { planner, layoutApi, edit, saved } = setup();
    edit(moveBasil(30));
    await saved();
    const d = planner.draft()!;
    planner.setDraft({ ...d, beds: [{ ...d.beds[0]!, name: 'Herbs' }] });
    planner.undo();
    await saved();
    expect(layoutApi.put).toHaveBeenCalledTimes(2);
    expect(layoutApi.put.mock.calls[1]![1].placements[0]!.xInches).toBe(12);
    expect(planner.draft()!.beds[0]!.name).toBe('Herbs');
  });

  it('undoing a new bed after it saved deletes it on the server', async () => {
    const { planner, layoutApi, edit, saved } = setup();
    edit((l) => ({ ...l, beds: [...l.beds, { id: 'b2', name: 'South', geometry }] }));
    await saved();
    expect(layoutApi.createBed).toHaveBeenCalledTimes(1);
    expect(planner.isSavedBed('b2')).toBe(true);
    planner.undo();
    await saved();
    expect(layoutApi.deleteBed).toHaveBeenCalledWith('g1', 'b2');
  });

  it('an edit made while saving is saved next, not lost', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const { planner, layoutApi, edit, saved } = setup({
      put: async () => {
        if (calls++ === 0) await gate;
      },
    });
    edit(moveBasil(20));
    await vi.waitFor(() => expect(planner.status()).toBe('saving'));
    edit(moveBasil(40));
    release();
    await saved();
    expect(layoutApi.put).toHaveBeenCalledTimes(2);
    expect(planner.draft()!.plantings[0]!.placement!.xInches).toBe(40);
    expect(planner.dirty()).toBe(false);
  });

  it('does not save plants placed too close, and says so', async () => {
    const { planner, layoutApi, edit } = setup();
    edit((l) => ({ ...l, plantings: [...l.plantings, seed('dill', 13)] }));
    await vi.waitFor(() => expect(planner.status()).toBe('blocked'));
    expect(planner.statusMessage()).toBe('Too close, or past a bed edge');
    expect(layoutApi.put).not.toHaveBeenCalled();
    expect(planner.unsaved()).toBe(true);
  });

  it('a failed save says why, and Retry saves it', async () => {
    let fail = true;
    const { planner, layoutApi, edit, saved } = setup({
      put: async () => {
        if (fail) throw new HttpErrorResponse({ status: 0 });
      },
    });
    edit(moveBasil(30));
    await vi.waitFor(() => expect(planner.status()).toBe('failed'));
    expect(planner.statusMessage()).toBe('You are offline');
    fail = false;
    await planner.retry();
    await saved();
    expect(layoutApi.put).toHaveBeenCalledTimes(2);
  });

  it('a confirmed delete happens now and clears the undo history', async () => {
    const { planner, plantingsApi, edit, saved } = setup();
    edit(moveBasil(30));
    await saved();
    await planner.deletePlantingNow('basil');
    expect(plantingsApi.remove).toHaveBeenCalledWith('g1', 'basil');
    expect(planner.draft()!.plantings).toEqual([]);
    expect(planner.canUndo()).toBe(false);
    expect(planner.dirty()).toBe(false);
  });
});
