import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import type { HarvestTotalsDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { GardenHarvestsPage } from './garden-harvests.page';
import { PlantingsApiService } from './plantings-api.service';
import { settled } from '../settled';

const season = (year: number, crops: HarvestTotalsDto['crops']): HarvestTotalsDto => ({
  seasonYear: year,
  seasons: [2027, 2026],
  crops,
});

async function render(harvestTotals: PlantingsApiService['harvestTotals']) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PlantingsApiService, useValue: { harvestTotals } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(GardenHarvestsPage);
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, text: () => el.textContent.replace(/\s+/g, ' ') };
}

describe('GardenHarvestsPage', () => {
  it('shows each crop’s season total and its harvests, and switches season', async () => {
    const harvestTotals = vi.fn(async (_g: string, year?: number) =>
      year === 2026
        ? season(2026, [])
        : season(2027, [
            {
              name: 'Tomato',
              grams: 1500,
              count: 2,
              harvests: [
                {
                  plantingId: 'p1',
                  plantName: 'Tomato (Cherry)',
                  harvestedOn: '2027-07-01',
                  grams: 1500,
                  count: 2,
                },
              ],
            },
          ]),
    );
    const view = await render(harvestTotals);
    expect(harvestTotals).toHaveBeenCalledWith('g1', undefined);
    expect(view.text()).toContain('Tomato');
    expect(view.text()).toContain('3.3 lb and 2 picked');
    expect(view.text()).toContain('Tomato (Cherry)');

    const select = view.el.querySelector<HTMLSelectElement>('select[name="season"]')!;
    select.value = select.options[1]!.value;
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(harvestTotals).toHaveBeenLastCalledWith('g1', 2026));
    await vi.waitFor(() => expect(view.text()).toContain('No harvests yet'));
  });

  it('says when the harvests cannot be loaded', async () => {
    const view = await render(vi.fn(async () => Promise.reject(new Error('offline'))));
    await vi.waitFor(() => expect(view.text()).toContain('Could not load harvests'));
  });
});
