import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type {
  GardenDetailDto,
  PlantListQueryDto,
  PlantSummaryDto,
} from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { CalendarApiService } from './calendar-api.service';
import { GardenWelcomePage } from './garden-welcome.page';
import { GardensApiService } from './gardens-api.service';
import { PlantingsApiService } from './plantings-api.service';

const crop = (cropId: string, name: string): PlantSummaryDto => ({
  id: `p-${cropId}`,
  commonName: name,
  species: name,
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 3,
  zoneMax: 10,
  spacingInches: 12,
  illustrationUrl: null,
  cropId,
});

const garden = (over: Partial<GardenDetailDto> = {}) =>
  ({
    id: 'g1',
    name: 'Backyard',
    hardinessZone: 7,
    lastFrost: { month: 4, day: 15 },
    firstFrost: { month: 10, day: 20 },
    frostFree: false,
    lengthInches: 240,
    widthInches: 120,
    myRole: 'owner',
    ...over,
  }) as GardenDetailDto;

async function render(g: GardenDetailDto = garden()) {
  const catalog = [crop('tomato', 'Tomato'), crop('radish', 'Radish'), crop('okra', 'Okra')];
  const list = vi.fn(async (q: PlantListQueryDto) => {
    const items = q.sowNowFor ? [catalog[1]!] : catalog;
    return { items, page: 1, pageSize: 100, totalCount: items.length };
  });
  const add = vi.fn(async () => ({}));
  const createBed = vi.fn(async () => ({ id: 'b1', name: 'Bed 1' }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
      { provide: GardensApiService, useValue: { detail: async () => g } },
      { provide: PlantsApiService, useValue: { list } },
      { provide: CalendarApiService, useValue: { add } },
      { provide: PlantingsApiService, useValue: { createBed } },
      { provide: AuthApiService, useValue: { units: signal('imperial') } },
    ],
  });
  const fixture = TestBed.createComponent(GardenWelcomePage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const text = () => el.textContent.replace(/\s+/g, ' ');
  const button = (name: RegExp) =>
    [...el.querySelectorAll('button')].find((b) => name.test(b.textContent.trim()))!;
  return { fixture, el, text, button, list, add, createBed };
}

describe('GardenWelcomePage', () => {
  it('shows the climate the address gave the property', async () => {
    const { text } = await render();
    expect(text()).toContain('Hardiness zone 7.');
    expect(text()).toContain('Last spring frost around Apr 15, first fall frost around Oct 20');
    const frostFree = await (TestBed.resetTestingModule(),
    render(garden({ lastFrost: null, firstFrost: null, frostFree: true })));
    expect(frostFree.text()).toContain('It rarely frosts here');
  });

  it('offers easy crops for the zone, those to sow this week first, and adds the picked ones', async () => {
    const { fixture, el, text, button, list, add } = await render();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ zone: 7, sowNowFor: 'g1', page: 1, pageSize: 100 }),
    );
    const labels = [...el.querySelectorAll('.starter-list label')].map((l) =>
      l.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toEqual(['Radish Sow this week', 'Tomato']);
    expect(button(/^Add 0 to the calendar$/).disabled).toBe(true);
    el.querySelectorAll<HTMLInputElement>('.starter-list input')[1]!.click();
    await fixture.whenStable();
    button(/^Add 1 to the calendar$/).click();
    await vi.waitFor(() => expect(add).toHaveBeenCalledWith('g1', { plantId: 'p-tomato' }));
    await fixture.whenStable();
    expect(text()).toContain('Tomato · on the calendar');
  });

  it('adds a first bed in the middle of the property', async () => {
    const { fixture, text, button, createBed } = await render();
    button(/^Add bed$/).click();
    await vi.waitFor(() =>
      expect(createBed).toHaveBeenCalledWith('g1', {
        name: 'Bed 1',
        lengthInches: 96,
        widthInches: 48,
        originXInches: 72,
        originYInches: 36,
      }),
    );
    await fixture.whenStable();
    expect(text()).toContain('Bed 1 is on the plan.');
  });
});
