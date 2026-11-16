import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import type { TransplantListDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { PlantsApiService } from '../plants/plants-api.service';
import { GardenTransplantsPage } from './garden-transplants.page';
import { GardensApiService } from './gardens-api.service';
import { LayoutApiService } from './layout-api.service';

const list: TransplantListDto = {
  gardenId: 'g1',
  myRole: 'owner',
  plantings: [],
  indoorReminders: [],
};

async function render(getTransplants: () => Promise<TransplantListDto | null>) {
  const transplants = vi.fn(getTransplants);
  TestBed.configureTestingModule({
    providers: [
      { provide: LayoutApiService, useValue: { getTransplants: transplants } },
      { provide: GardensApiService, useValue: { detail: async () => ({ name: 'Home' }) } },
      { provide: PlantsApiService, useValue: {} },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 'g1' }) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(GardenTransplantsPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const text = () => el.textContent.replace(/\s+/g, ' ');
  return { fixture, el, text, transplants };
}

const unreachable = () => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });

describe('GardenTransplantsPage', () => {
  it('a load cut off by the network says so, not "not found", and reloads when back online', async () => {
    let calls = 0;
    const view = await render(async () => {
      if (calls++ === 0) throw unreachable();
      return list;
    });
    expect(view.text()).toContain('Could not load transplants while offline');
    expect(view.text()).not.toContain('Garden unavailable or not found');
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(view.transplants).toHaveBeenCalledTimes(2));
    await view.fixture.whenStable();
    expect(view.text()).not.toContain('Could not load transplants');
    expect(view.el.querySelector('input[name="transplantSearch"]')).not.toBeNull();
  });

  it('a server error shows its message and Try again reloads', async () => {
    let calls = 0;
    const view = await render(async () => {
      if (calls++ === 0) {
        throw new HttpErrorResponse({
          status: 500,
          error: { error: { message: 'Database down' } },
        });
      }
      return list;
    });
    expect(view.text()).toContain('Could not load transplants: Database down');
    [...view.el.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Try again'))!
      .click();
    await vi.waitFor(() => expect(view.transplants).toHaveBeenCalledTimes(2));
    await view.fixture.whenStable();
    expect(view.text()).not.toContain('Could not load transplants');
  });

  it('a property that does not exist still says so', async () => {
    const view = await render(async () => null);
    expect(view.text()).toContain('Garden unavailable or not found');
  });
});
