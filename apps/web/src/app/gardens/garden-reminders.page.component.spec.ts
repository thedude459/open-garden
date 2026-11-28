import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import { settled } from '../settled';
import { GardenRemindersPage } from './garden-reminders.page';
import { PlantingsApiService } from './plantings-api.service';
import { RemindersApiService } from './reminders-api.service';
import type { ClientReminderList } from './reminders-offline.queue';

const scout = {
  plantingId: 'b1',
  kind: 'scout' as const,
  dueOn: '2026-06-01',
  urgency: 'dueToday' as const,
  intervalDays: 7,
  plantId: '',
  commonName: 'Aphids, Flea beetles',
  species: '',
  cultivar: null,
  plantType: 'vegetable' as const,
  status: 'active' as const,
  required: true,
  rainNote: null,
  bedId: 'b1',
  bedName: 'North',
  pests: [
    { id: 'aphids', name: 'Aphids' },
    { id: 'flea-beetles', name: 'Flea beetles' },
  ],
};
const list = (over: Partial<ClientReminderList> = {}): ClientReminderList => ({
  gardenId: 'g1',
  asOf: '2026-06-01',
  myRole: 'owner',
  outlookOn: null,
  items: [scout],
  ignoredPests: [],
  ...over,
});

async function render(first: ClientReminderList, after: ClientReminderList) {
  const ignorePest = vi.fn(async () => after);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
      { provide: RemindersApiService, useValue: { list: async () => first, ignorePest } },
      { provide: PlantingsApiService, useValue: { list: async () => ({ plantings: [{}] }) } },
      { provide: AuthApiService, useValue: { units: signal('imperial') } },
    ],
  });
  const fixture = TestBed.createComponent(GardenRemindersPage);
  fixture.autoDetectChanges();
  await settled(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement, ignorePest };
}

describe('GardenRemindersPage pests', () => {
  it('marks a Scout task’s pest not a problem here, then lists it to show again', async () => {
    const after = list({
      items: [{ ...scout, commonName: 'Flea beetles', pests: [scout.pests[1]!] }],
      ignoredPests: [{ id: 'aphids', name: 'Aphids' }],
    });
    const { fixture, el, ignorePest } = await render(list(), after);
    expect(el.textContent).toContain('Aphids, Flea beetles');
    el.querySelector<HTMLButtonElement>('[aria-label="Not a problem here: Aphids"]')!.click();
    await settled(fixture);
    expect(ignorePest).toHaveBeenCalledWith('g1', 'aphids', false);
    const ignored = el.querySelector('[aria-labelledby="ignored-pests-heading"]')!;
    expect(ignored.textContent).toContain('Aphids');
    ignored.querySelector<HTMLButtonElement>('[aria-label="Show again: Aphids"]')!.click();
    await settled(fixture);
    expect(ignorePest).toHaveBeenLastCalledWith('g1', 'aphids', true);
  });

  it('offers no pest buttons to a viewer', async () => {
    const viewer = list({ myRole: 'viewer', ignoredPests: [{ id: 'cpb', name: 'Beetle' }] });
    const { el } = await render(viewer, viewer);
    expect(el.querySelector('[aria-label^="Not a problem here"]')).toBeNull();
    expect(el.querySelector('[aria-label^="Show again"]')).toBeNull();
    expect(el.textContent).toContain('Beetle');
  });

  it('says so when the change cannot be saved', async () => {
    const { fixture, el, ignorePest } = await render(list(), list());
    ignorePest.mockRejectedValueOnce(new Error('offline'));
    el.querySelector<HTMLButtonElement>('[aria-label="Not a problem here: Aphids"]')!.click();
    await settled(fixture);
    expect(el.querySelector('.error')?.textContent).toContain('try when online');
  });
});
