import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import type { GardenRole } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { NoticeService } from '../ui/notice.service';
import { GardenPlantingsPage } from './garden-plantings.page';
import { planting } from './planting.testing';
import { PlantingsApiService } from './plantings-api.service';
import type { ClientPlantingList } from './plantings-offline.queue';

const list = (myRole: GardenRole = 'owner'): ClientPlantingList => ({
  gardenId: 'g1',
  myRole,
  page: 1,
  pageSize: 100,
  total: 2,
  beds: [{ id: 'b1', name: 'North' } as ClientPlantingList['beds'][number]],
  plantings: [
    planting({ id: 'p1', commonName: 'Tomato', bedId: 'b1' }),
    planting({ id: 'p2', commonName: 'Basil', bedId: null }),
  ],
});

async function render(api: Partial<PlantingsApiService>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PlantingsApiService, useValue: { syncFailures: async () => [], ...api } },
      { provide: PlantsApiService, useValue: {} },
      { provide: FavoritesApiService, useValue: {} },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(GardenPlantingsPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const text = () => el.textContent.replace(/\s+/g, ' ');
  const byLabel = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const button = (name: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
  return { fixture, el, text, byLabel, button };
}

describe('GardenPlantingsPage', () => {
  it('groups plantings by bed and filters to one bed', async () => {
    const view = await render({ list: async () => list() });
    expect(view.text()).toContain('Tomato');
    expect(view.text()).toContain('Basil');
    const filter = view.el.querySelector<HTMLSelectElement>('select[name="bedFilter"]')!;
    filter.value = 'b1';
    filter.dispatchEvent(new Event('change'));
    await view.fixture.whenStable();
    expect(view.text()).toContain('Tomato');
    expect(view.text()).not.toContain('Basil');
    view.button('Show all')!.click();
    await view.fixture.whenStable();
    expect(view.text()).toContain('Basil');
  });

  it('saves an edit and shows the saved planting', async () => {
    const update = vi.fn(async (_g: string, id: string) =>
      planting({ id, commonName: 'Tomato', bedId: 'b1', harvestedOn: '2027-08-01' }),
    );
    const view = await render({ list: async () => list(), update });
    view.byLabel('Edit Tomato')!.click();
    await view.fixture.whenStable();
    view.button('Save planting')!.click();
    await vi.waitFor(() => expect(view.text()).toContain('Harvested'));
    expect(update).toHaveBeenCalledWith('g1', 'p1', expect.objectContaining({ bedId: 'b1' }));
  });

  it('refuses a harvest before planting and reloads the saved dates', async () => {
    const load = vi.fn(async () => list());
    const update = vi.fn();
    const view = await render({ list: load, update });
    view.byLabel('Edit Tomato')!.click();
    await view.fixture.whenStable();
    view.el.querySelector<HTMLInputElement>('[name="harvested-p1"]')!.value = '2027-01-01';
    view.button('Save planting')!.click();
    await vi.waitFor(() => expect(view.el.querySelector('.error')).not.toBeNull());
    expect(update).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('removes a planting after confirming', async () => {
    const remove = vi.fn(async () => undefined);
    const view = await render({ list: async () => list(), remove });
    view.byLabel('Edit Basil')!.click();
    await view.fixture.whenStable();
    view.byLabel('Remove Basil')!.click();
    await view.fixture.whenStable();
    view.button('Confirm remove')!.click();
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith('g1', 'p2'));
  });

  it('a viewer sees plantings without add or edit controls', async () => {
    const view = await render({ list: async () => list('viewer') });
    expect(view.text()).toContain('Tomato');
    expect(view.el.querySelector('og-planting-add')).toBeNull();
    expect(view.byLabel('Edit Tomato')).toBeNull();
  });

  it('says the property is unavailable when it cannot be read', async () => {
    const view = await render({ list: async () => null });
    expect(view.text()).toContain('Garden unavailable or not found.');
  });

  it('adds a succession series and says how many sowings it added', async () => {
    let calls = 0;
    const repeat = vi.fn(async () => undefined);
    const withSeries = (): ClientPlantingList => {
      const base = list();
      return {
        ...base,
        plantings: [
          ...base.plantings,
          planting({ id: 'p3', commonName: 'Tomato', plantedOn: '2027-05-15' }),
          planting({ id: 'p4', commonName: 'Tomato', plantedOn: '2027-05-29' }),
        ],
      };
    };
    const view = await render({
      list: async () => (calls++ === 0 ? list() : withSeries()),
      repeat,
    });
    view.byLabel('Edit Tomato')!.click();
    await view.fixture.whenStable();
    view.button('Repeat sowing')!.click();
    await view.fixture.whenStable();
    const until = view.el.querySelector<HTMLInputElement>('input[name="repeatUntil"]')!;
    until.value = '2027-06-01';
    until.dispatchEvent(new Event('input'));
    view.button('Add sowings')!.click();
    await vi.waitFor(() => expect(repeat).toHaveBeenCalled());
    expect(repeat).toHaveBeenCalledWith('g1', 'p1', { everyWeeks: 2, until: '2027-06-01' });
    await vi.waitFor(() =>
      expect(TestBed.inject(NoticeService).current()?.message).toBe('Added 2 sowings of Tomato.'),
    );
  });
});
