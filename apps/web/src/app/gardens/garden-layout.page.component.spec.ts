import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { GardenLayoutDto, GardenRole } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { GardenLayoutPage } from './garden-layout.page';
import { GardenPlanCanvas } from './garden-plan-canvas';
import { GardensApiService } from './gardens-api.service';
import { LayoutApiService } from './layout-api.service';
import { PlannerDraftService } from './planner-draft.service';
import { settled } from '../settled';

const layout = (myRole: GardenRole): GardenLayoutDto => ({
  gardenId: 'g1',
  myRole,
  beds: [
    {
      id: 'b1',
      name: 'North',
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
  plantings: [],
  flags: [],
});

async function render(myRole: GardenRole = 'owner', autosaveDelayMs = 60_000) {
  const layoutApi = {
    put: vi.fn(async () => planner.draft()!),
    createBed: vi.fn(async () => undefined),
    deleteBed: vi.fn(async () => undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LayoutApiService, useValue: layoutApi },
      {
        provide: GardensApiService,
        useValue: {
          detail: async () => ({ name: 'Home', frostFree: true }),
          areas: async () => [],
          trays: async () => [],
        },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
    ],
  });
  // jsdom has no SVG screen matrix, so the plan's visible centre is the origin.
  vi.spyOn(GardenPlanCanvas.prototype, 'viewportCenterPlan').mockReturnValue({ x: 0, y: 0 });
  const planner = TestBed.inject(PlannerDraftService);
  planner.autosaveDelayMs = autosaveDelayMs;
  vi.spyOn(planner, 'load').mockImplementation(async () => {
    planner.gardenId = 'g1';
    planner.hydrate(layout(myRole));
    planner.loading.set(false);
    return planner.draft();
  });
  const fixture = TestBed.createComponent(GardenLayoutPage);
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const openAdd = async (label: string) => {
    [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add')!.click();
    await settled(fixture);
    byLabel(label)!.click();
    await settled(fixture);
  };
  return { fixture, el, byLabel, openAdd, planner, layoutApi };
}

describe('GardenLayoutPage', () => {
  it('a new bed saves itself, then its name and settings can be changed', async () => {
    const view = await render('owner', 10);
    await view.openAdd('Add bed');
    const name = view.el.querySelector<HTMLInputElement>('[name="bedName"]')!;
    name.value = 'South';
    name.dispatchEvent(new Event('input'));
    view.el.querySelector('form[aria-label="New bed"]')!.dispatchEvent(new Event('submit'));
    await settled(view.fixture);
    const south = view.planner.draft()!.beds.find((b) => b.name === 'South')!;
    expect(south).toBeDefined();
    await vi.waitFor(() => expect(view.el.textContent).toContain('All changes saved'));
    expect(view.layoutApi.createBed).toHaveBeenCalledTimes(1);
    expect(view.planner.isSavedBed(south.id)).toBe(true);
    expect(view.byLabel('Rename South')).not.toBeNull();
  });

  it('Add tree makes an 8 by 8 ft tree bed', async () => {
    const view = await render();
    await view.openAdd('Add tree');
    const tree = view.planner.draft()!.beds.find((b) => b.station === 'tree')!;
    expect(tree.name).toBe('Tree');
    expect(tree.geometry).toMatchObject({ lengthInches: 96, widthInches: 96 });
  });

  it('deleting a bed not yet saved drops it from the draft', async () => {
    const view = await render();
    await view.openAdd('Add tree');
    view.byLabel('Delete bed Tree')!.click();
    await settled(view.fixture);
    view.byLabel('Confirm delete Tree')!.click();
    await settled(view.fixture);
    expect(view.planner.draft()!.beds.map((b) => b.name)).toEqual(['North']);
    expect(view.planner.dirty()).toBe(false);
  });

  it('plants sown in a bed that was never saved go with it', async () => {
    const view = await render();
    await view.openAdd('Add tree');
    const d = view.planner.draft()!;
    const tree = d.beds.find((b) => b.name === 'Tree')!;
    view.planner.setDraft({
      ...d,
      plantings: [
        {
          id: 'apple',
          plantId: 'apple',
          commonName: 'Apple',
          species: 'Malus',
          cultivar: null,
          plantType: 'tree',
          status: 'active',
          bedId: tree.id,
          spacingInches: 96,
          startMethod: 'direct_seed',
          indoorStartedOn: null,
          placement: { plantingId: 'apple', bedId: tree.id, xInches: 48, yInches: 48 },
        },
      ],
    });
    await settled(view.fixture);
    view.byLabel('Delete bed Tree')!.click();
    await settled(view.fixture);
    view.byLabel('Confirm delete Tree')!.click();
    await settled(view.fixture);
    expect(view.planner.draft()!.plantings).toEqual([]);
    expect(view.planner.dirty()).toBe(false);
  });

  it('a viewer sees the beds without Add, Edit, or Undo', async () => {
    const view = await render('viewer');
    expect(view.byLabel('Open bed North')).not.toBeNull();
    expect(view.byLabel('Edit bed North')).toBeNull();
    expect(view.el.textContent).not.toContain('Undo');
  });
});
