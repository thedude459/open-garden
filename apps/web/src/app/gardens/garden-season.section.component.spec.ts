import { TestBed } from '@angular/core/testing';
import type { SeasonDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { NoticeService } from '../ui/notice.service';
import { CalendarApiService } from './calendar-api.service';
import { GardenSeasonSection } from './garden-season.section';
import { GardensApiService } from './gardens-api.service';

const season = (over: Partial<SeasonDto> = {}): SeasonDto => ({
  openYear: 2027,
  closedYear: null,
  review: [],
  plantAgain: [],
  pairs: [],
  householdPlants: [
    { id: 'tomato', commonName: 'Tomato' },
    { id: 'basil', commonName: 'Basil' },
  ],
  ...over,
});

async function render(api: Partial<GardensApiService>, canEdit = true) {
  const calendar = { add: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: GardensApiService, useValue: api },
      { provide: CalendarApiService, useValue: calendar },
    ],
  });
  const fixture = TestBed.createComponent(GardenSeasonSection);
  fixture.componentRef.setInput('gardenId', 'g1');
  fixture.componentRef.setInput('canEdit', canEdit);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
  return { fixture, el, button, calendar, notices: spyNotices() };
}

/** Records what the section told the member; notices dismiss themselves on a timer. */
function spyNotices() {
  const notices = TestBed.inject(NoticeService);
  const said: string[] = [];
  vi.spyOn(notices, 'success').mockImplementation((message) => (said.push(message), true));
  vi.spyOn(notices, 'error').mockImplementation((message) => (said.push(message), true));
  return { said };
}

describe('GardenSeasonSection', () => {
  it('shows the open season and lets an editor close it', async () => {
    const closed = season({
      openYear: 2028,
      closedYear: 2027,
      review: [{ id: 'p1', plantId: 'basil', commonName: 'Basil', bedName: 'North' } as never],
      plantAgain: [{ plantId: 'basil', bedId: 'b1', commonName: 'Basil', bedName: 'North' }],
    });
    const api = {
      season: vi.fn().mockResolvedValue(season()),
      closeSeason: vi.fn().mockResolvedValue(closed),
    };
    const view = await render(api);
    expect(api.season).toHaveBeenCalledWith('g1');
    expect(view.el.querySelector('h3')!.textContent).toBe('Season 2027');

    view.button('Close season')!.click();
    await view.fixture.whenStable();
    expect(view.el.querySelector('h3')!.textContent).toBe('Season 2028');
    expect(view.el.textContent.replace(/\s+/g, ' ')).toContain('Basil · North');
    expect(view.notices.said).toContain('Season closed');

    view.button('Plant again')!.click();
    await view.fixture.whenStable();
    expect(view.calendar.add).toHaveBeenCalledWith('g1', { plantId: 'basil' });
  });

  it('adds a household pair, and only with a reason', async () => {
    const withPair = season({
      pairs: [
        {
          id: 'x',
          plantId: 'tomato',
          otherPlantId: 'basil',
          plantName: 'Tomato',
          otherName: 'Basil',
          kind: 'hinders',
          reason: 'Shades our basil',
        },
      ],
    });
    const api = {
      season: vi.fn().mockResolvedValue(season()),
      addCompanion: vi.fn().mockResolvedValue(withPair),
    };
    const view = await render(api);
    const section = view.fixture.componentInstance;
    section.pairLeft = 'tomato';
    section.pairRight = 'basil';
    section.pairKind = 'hinders';
    await section.addPair();
    expect(api.addCompanion).not.toHaveBeenCalled();

    section.pairReason = ' Shades our basil ';
    await section.addPair();
    await view.fixture.whenStable();
    expect(api.addCompanion).toHaveBeenCalledWith('g1', {
      plantId: 'tomato',
      otherPlantId: 'basil',
      kind: 'hinders',
      reason: 'Shades our basil',
    });
    expect(view.el.textContent).toContain('Tomato hinders Basil — Shades our basil');
    expect(section.pairReason).toBe('');
  });

  it('gives a viewer no controls', async () => {
    const view = await render({ season: vi.fn().mockResolvedValue(season()) }, false);
    expect(view.el.querySelector('h3')!.textContent).toBe('Season 2027');
    expect(view.button('Close season')).toBeUndefined();
    expect(view.el.querySelector('form')).toBeNull();
  });

  it('is left out when the season cannot be read, and says when closing fails', async () => {
    const offline = await render({ season: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(offline.el.querySelector('section')).toBeNull();

    TestBed.resetTestingModule();
    const view = await render({
      season: vi.fn().mockResolvedValue(season()),
      closeSeason: vi.fn().mockRejectedValue(new Error('no')),
    });
    view.button('Close season')!.click();
    await view.fixture.whenStable();
    expect(view.notices.said).toContain('Could not close the season');
    expect(view.el.querySelector('h3')!.textContent).toBe('Season 2027');
  });
});
