import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { GardenSummaryDto, PlantDetailDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { CalendarApiService } from '../gardens/calendar-api.service';
import { GardensApiService } from '../gardens/gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { SowingTimeline } from './sowing-timeline';

const tomato = {
  id: 't1',
  commonName: 'Tomato',
  daysToMaturity: 65,
  sowingTemperature: null,
  growingGuidance: {
    indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
    outdoorSow: null,
    transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 2 },
    fallSow: null,
  },
} as unknown as PlantDetailDto;

const garden = (id: string, name: string, myRole = 'owner') =>
  ({ id, name, myRole }) as GardenSummaryDto;

@Component({
  standalone: true,
  imports: [SowingTimeline],
  template: `<og-sowing-timeline [plant]="plant()" />`,
})
class Host {
  readonly plant = signal(tomato);
}

async function render(gardens: GardenSummaryDto[]) {
  const details: Record<string, object> = {
    g1: {
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
      monthlyMeanC: null,
    },
    g2: { lastFrost: null, firstFrost: null, monthlyMeanC: null },
  };
  const add = vi.fn(async () => ({}));
  const success = vi.fn();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      provideRouter([]),
      {
        provide: GardensApiService,
        useValue: {
          listAll: async () => ({ items: gardens, page: 1, pageSize: 100, totalCount: 1 }),
          detail: async (id: string) => details[id],
        },
      },
      { provide: CalendarApiService, useValue: { add } },
      {
        provide: NoticeService,
        useValue: {
          busyMap: signal(new Set()),
          run: async (_k: string, work: () => Promise<void>) => (await work(), true),
          success,
          error: vi.fn(),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement, add, success };
}

describe('SowingTimeline', () => {
  it('shows when to sow at the first property, and adds the crop to its plan', async () => {
    const { el, add, success } = await render([garden('g1', 'Home')]);
    const labels = [...el.querySelectorAll('.label')].map((l) =>
      l.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toHaveLength(3);
    expect(labels[0]).toBe('Start indoors Feb 18 – Mar 4');
    expect(labels[1]).toMatch(/^Plant out /);
    expect(labels[2]).toMatch(/^Harvest /);
    el.querySelector<HTMLButtonElement>('button')!.click();
    await vi.waitFor(() => expect(add).toHaveBeenCalledWith('g1', { plantId: 't1' }));
    expect(success).toHaveBeenCalledWith('Added to the Home calendar');
  });

  it('asks for frost dates where nothing places the windows', async () => {
    const { el, fixture } = await render([garden('g1', 'Home'), garden('g2', 'Cabin')]);
    const select = el.querySelector('select')!;
    select.value = select.options[1]!.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(el.textContent).toContain("Set this property's frost dates");
  });

  it('hides Add to plan from viewers, and points to properties when there are none', async () => {
    const viewer = await render([garden('g1', 'Shared', 'viewer')]);
    expect(viewer.el.querySelector('button')).toBeNull();
    TestBed.resetTestingModule();
    const none = await render([]);
    expect(none.el.textContent).toContain('Add a property');
  });
});
