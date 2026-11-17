import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { GardenDetailDto, GardenRole } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import { CalendarApiService } from './calendar-api.service';
import { GardenDetailPage } from './garden-detail.page';
import { GardensApiService } from './gardens-api.service';
import { PlannerDraftService } from './planner-draft.service';

const place = {
  formattedAddress: '1 Main St',
  latitude: 38.9,
  longitude: -77,
  placeId: 'p1',
  postalCode: null,
  countryCode: null,
};

const garden = (over: Partial<GardenDetailDto> = {}): GardenDetailDto =>
  ({
    id: 'g1',
    name: 'Home',
    notes: null,
    hardinessZone: 7,
    lastFrost: { month: 4, day: 20 },
    firstFrost: { month: 10, day: 20 },
    frostFree: false,
    monthlyMeanC: null,
    frostRisk: null,
    lengthInches: 240,
    widthInches: 120,
    myRole: 'owner',
    ownerUserId: 'me',
    members: [],
    place,
    ...over,
  }) as GardenDetailDto;

async function render(myRole: GardenRole = 'owner', over: Partial<GardenDetailDto> = {}) {
  const refilled = garden({
    myRole,
    ...over,
    hardinessZone: 8,
    lastFrost: { month: 4, day: 15 },
    seasonNotice: 'Zone and frost dates updated for this address.',
  } as Partial<GardenDetailDto>);
  const api = {
    detail: vi.fn(async () => garden({ myRole, ...over })),
    patch: vi.fn(async () => refilled),
    season: vi.fn(async () => ({
      openYear: 2026,
      closedYear: null,
      review: [],
      plantAgain: [],
      pairs: [],
      householdPlants: [],
    })),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
      { provide: GardensApiService, useValue: api },
      { provide: CalendarApiService, useValue: {} },
      { provide: PlannerDraftService, useValue: { discard: vi.fn() } },
      {
        provide: AuthApiService,
        useValue: { units: signal('imperial'), currentUserId: () => 'me' },
      },
    ],
  });
  const fixture = TestBed.createComponent(GardenDetailPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
  return { fixture, el, api, button };
}

describe('GardenDetailPage (Settings)', () => {
  it('groups settings into sections, with links to each', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll('nav.settings-nav a')];
    expect(links.map((a) => a.textContent.trim())).toEqual([
      'Property',
      'Location & climate',
      'Members',
      'Seasons',
      'Leave or delete',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/#property',
      '/#climate',
      '/#members',
      '/#seasons',
      '/#danger',
    ]);
    for (const id of ['property', 'climate', 'members', 'seasons', 'danger']) {
      expect(el.querySelector(`section#${id}`), id).not.toBeNull();
    }
    expect(el.querySelector('#property input[name="name"]')).not.toBeNull();
    expect(el.querySelector('#climate select[name="zone"]')).not.toBeNull();
    expect(el.querySelector('#danger h3')!.textContent.trim()).toBe('Delete this property');
  });

  it('fills the climate in again from the saved address', async () => {
    const { fixture, el, api, button } = await render();
    button("Use this address's climate")!.click();
    await vi.waitFor(() => expect(api.patch).toHaveBeenCalledWith('g1', { place }));
    await fixture.whenStable();
    expect(el.querySelector<HTMLSelectElement>('select[name="zone"]')!.value).toBe('8');
    expect(el.textContent).toContain('Zone and frost dates updated for this address.');
  });

  it('offers the refill only to editors of a property with an address', async () => {
    expect((await render('viewer')).button("Use this address's climate")).toBeUndefined();
    TestBed.resetTestingModule();
    expect(
      (await render('owner', { place: null })).button("Use this address's climate"),
    ).toBeUndefined();
  });
});
