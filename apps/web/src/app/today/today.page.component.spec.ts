import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import type { TodayDto } from '@open-garden/shared-types';
import { NEVER } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import { GardensApiService } from '../gardens/gardens-api.service';
import { RemindersApiService } from '../gardens/reminders-api.service';
import { NotificationsApiService } from './notifications-api.service';
import { TodayPage } from './today.page';
import { settled } from '../settled';

const alert = (over: Partial<NonNullable<TodayDto['alerts']>[number]> = {}) => ({
  gardenId: 'g1',
  gardenName: 'Home',
  kind: 'frost' as const,
  date: '2026-11-18',
  tempC: -2,
  plantings: [{ name: 'Tomato', bedName: 'North' }],
  ...over,
});

async function render(today: TodayDto, units: 'metric' | 'imperial' = 'metric') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: GardensApiService,
        useValue: {
          listAll: async () => ({ items: [{ id: 'g1' }], page: 1, pageSize: 100, totalCount: 1 }),
          today: async () => today,
        },
      },
      { provide: RemindersApiService, useValue: {} },
      { provide: AuthApiService, useValue: { units: signal(units) } },
      {
        provide: NotificationsApiService,
        useValue: { settings: async () => ({ emailDigest: false, pushDevices: 0 }) },
      },
      { provide: SwPush, useValue: { isEnabled: false, subscription: NEVER } },
    ],
  });
  const fixture = TestBed.createComponent(TodayPage);
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  return { el, text: () => el.textContent.replace(/\s+/g, ' ') };
}

describe('TodayPage weather', () => {
  it('shows frost and heat ahead, soonest first, in the member’s units', async () => {
    const view = await render({
      tasks: [],
      gardens: [],
      alerts: [
        alert({
          kind: 'heat',
          date: '2026-11-20',
          tempC: 31,
          plantings: [{ name: 'Lettuce', bedName: null }],
        }),
        alert(),
      ],
    });
    const rows = [...view.el.querySelectorAll('.weather-alert')].map((r) =>
      r.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toEqual([
      'Frost likely Wed, Nov 18 (low -2 °C)Home: Cover Tomato (North)',
      'Heat Fri, Nov 20 (high 31 °C)Home: Shade and water Lettuce',
    ]);
    // Weather alone is something to see, not "nothing to do".
    expect(view.text()).not.toContain('Nothing to do today');
  });

  it('shows no weather section without alerts, nor for a Today cached before alerts existed', async () => {
    const view = await render({ tasks: [], gardens: [] }, 'imperial');
    expect(view.el.querySelector('.weather-alerts')).toBeNull();
    expect(view.text()).toContain('Nothing to do today');
  });
});
