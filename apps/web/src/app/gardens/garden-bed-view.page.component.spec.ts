import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { GardenLayoutDto, GardenRole, LayoutPlantingDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { GardenBedViewPage } from './garden-bed-view.page';
import { GardensApiService } from './gardens-api.service';
import { PlannerDraftService } from './planner-draft.service';

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

async function render(myRole: GardenRole = 'owner') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
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
  vi.spyOn(planner, 'load').mockImplementation(async () => {
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
  return { fixture, el, byLabel, remove, planner };
}

describe('GardenBedViewPage', () => {
  it('removing a direct seed deletes it on save; a transplant goes back to waiting', async () => {
    const view = await render();
    expect(view.el.textContent).toContain('In this bed');
    await view.remove('Basil');
    expect(view.planner.pendingDirectSeedDeletes.has('Basil')).toBe(true);
    await view.remove('Tomato');
    const tomato = view.planner.draft()!.plantings.find((p) => p.id === 'Tomato')!;
    expect(tomato.placement).toBeNull();
    expect(view.el.textContent).toContain('Unsaved changes');
    expect(view.byLabel('Remove from bed Tomato')).toBeNull();
  });

  it('a viewer sees the bed without the plant panel or Save', async () => {
    const view = await render('viewer');
    expect(view.el.textContent).toContain('Basil');
    expect(view.el.textContent).not.toContain('Add a plant');
    expect(view.el.textContent).not.toContain('Save layout');
  });
});
