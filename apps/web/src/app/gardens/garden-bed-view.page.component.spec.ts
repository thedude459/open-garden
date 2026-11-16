import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { GardenLayoutDto, GardenRole, LayoutPlantingDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { GardenBedViewPage } from './garden-bed-view.page';
import { GardensApiService } from './gardens-api.service';
import { LayoutApiService } from './layout-api.service';
import { PlannerDraftService } from './planner-draft.service';
import { PlantingsApiService } from './plantings-api.service';

const planting = (
  id: string,
  startMethod: LayoutPlantingDto['startMethod'],
): LayoutPlantingDto => ({
  id,
  plantId: id,
  commonName: id,
  species: id,
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  bedId: 'b1',
  spacingInches: 12,
  startMethod,
  indoorStartedOn: null,
  placement: { plantingId: id, bedId: 'b1', xInches: 12, yInches: 12 },
});

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
  plantings: [planting('Basil', 'direct_seed'), planting('Tomato', 'transplant')],
  flags: [],
});

async function render(myRole: GardenRole = 'owner', autosaveDelayMs = 60_000) {
  const plantingsApi = { remove: vi.fn(async () => undefined) };
  const layoutApi = { put: vi.fn(async () => planner.draft()!) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PlantingsApiService, useValue: plantingsApi },
      { provide: LayoutApiService, useValue: layoutApi },
      { provide: GardensApiService, useValue: { detail: async () => ({ name: 'Home' }) } },
      { provide: FavoritesApiService, useValue: { list: async () => ({ items: [] }) } },
      { provide: PlantsApiService, useValue: { list: async () => ({ items: [] }) } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1', bedId: 'b1' }) } },
      },
    ],
  });
  const planner = TestBed.inject(PlannerDraftService);
  planner.autosaveDelayMs = autosaveDelayMs;
  vi.spyOn(planner, 'load').mockImplementation(async () => {
    planner.gardenId = 'g1';
    planner.hydrate(layout(myRole));
    planner.loading.set(false);
    return planner.draft();
  });
  vi.spyOn(planner, 'syncWaitingTransplants').mockResolvedValue(undefined);
  const fixture = TestBed.createComponent(GardenBedViewPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const remove = async (name: string) => {
    byLabel(`Remove from bed ${name}`)!.click();
    await fixture.whenStable();
    byLabel(`Confirm remove ${name}`)!.click();
    await fixture.whenStable();
  };
  return { fixture, el, byLabel, remove, planner, plantingsApi, layoutApi };
}

describe('GardenBedViewPage', () => {
  it('removing a saved direct seed deletes it now; a transplant goes back to waiting and autosaves', async () => {
    const view = await render('owner', 10);
    expect(view.el.textContent).toContain('In this bed');
    await view.remove('Basil');
    await vi.waitFor(() => expect(view.plantingsApi.remove).toHaveBeenCalledWith('g1', 'Basil'));
    expect(view.planner.draft()!.plantings.some((p) => p.id === 'Basil')).toBe(false);
    expect(view.planner.canUndo()).toBe(false);
    await view.remove('Tomato');
    const tomato = view.planner.draft()!.plantings.find((p) => p.id === 'Tomato')!;
    expect(tomato.placement).toBeNull();
    expect(view.byLabel('Remove from bed Tomato')).toBeNull();
    await vi.waitFor(() => expect(view.el.textContent).toContain('All changes saved'));
    expect(view.layoutApi.put).toHaveBeenCalledTimes(1);
    expect(view.planner.canUndo()).toBe(true);
  });

  it('a viewer sees the bed without the plant panel or Undo', async () => {
    const view = await render('viewer');
    expect(view.el.textContent).toContain('Basil');
    expect(view.el.textContent).not.toContain('Add a plant');
    expect(view.el.textContent).not.toContain('Undo');
  });
});
