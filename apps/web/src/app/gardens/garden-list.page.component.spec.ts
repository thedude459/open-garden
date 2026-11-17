import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { GardenSummaryDto, TodayDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { GardenListPage } from './garden-list.page';
import { GardensApiService } from './gardens-api.service';

const garden = (over: Partial<GardenSummaryDto> = {}): GardenSummaryDto => ({
  id: 'g1',
  name: 'Home',
  hardinessZone: 6,
  myRole: 'owner',
  bedCount: 2,
  placementCount: 3,
  plan: {
    lengthInches: 240,
    widthInches: 120,
    beds: [
      { x: 12, y: 12, w: 96, h: 48 },
      { x: 120, y: 12, w: 48, h: 96 },
    ],
  },
  ...over,
});

async function render(gardens: GardenSummaryDto[], today: TodayDto | Error) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: GardensApiService,
        useValue: {
          listAll: async () => ({
            items: gardens,
            page: 1,
            pageSize: 20,
            totalCount: gardens.length,
          }),
          today: async () => {
            if (today instanceof Error) throw today;
            return today;
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(GardenListPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const text = () => el.textContent.replace(/\s+/g, ' ');
  return { el, text, fixture };
}

describe('GardenListPage property cards', () => {
  it('draws a small plan of the property and its beds', async () => {
    const view = await render([garden()], { tasks: [], gardens: [] });
    const thumb = view.el.querySelector('svg.garden-thumb')!;
    expect(thumb.getAttribute('viewBox')).toBe('0 0 240 120');
    expect(thumb.querySelectorAll('.garden-thumb-bed')).toHaveLength(2);
    expect(view.text()).toContain('3 plants in beds');
  });

  it("names each property's most urgent task", async () => {
    const view = await render([garden(), garden({ id: 'g2', name: 'Allotment' })], {
      tasks: [
        { gardenId: 'g1', gardenName: 'Home', kind: 'thisWeek', title: 'Sow peas', bedName: null },
        {
          gardenId: 'g1',
          gardenName: 'Home',
          kind: 'overdue',
          title: 'Water tomato',
          bedName: 'North',
        },
      ],
      gardens: [{ id: 'g1', overdue: 1, thisWeek: 1 }],
    });
    expect(view.text()).toContain('Overdue: Water tomato · North');
    expect(view.text()).not.toContain('Sow peas');
    expect(view.el.querySelectorAll('.garden-next')).toHaveLength(1);
  });

  it('still lists properties when Today cannot load, and older summaries without a plan', async () => {
    const view = await render([garden({ plan: undefined })], new Error('offline'));
    expect(view.text()).toContain('Home');
    expect(view.el.querySelector('svg.garden-thumb')).toBeNull();
    expect(view.el.querySelector('.garden-next')).toBeNull();
  });

  it('offers the guided setup for a first property, and opens it', async () => {
    const view = await render([garden()], { tasks: [], gardens: [] });
    expect(view.text()).not.toContain('Next: set up your new property');
    view.fixture.componentInstance.setUpId.set('g1');
    await view.fixture.whenStable();
    expect(view.text()).toContain('Next: set up your new property');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    [...view.el.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Start setup')!
      .click();
    expect(navigate).toHaveBeenCalledWith(['/gardens', 'g1', 'welcome']);
  });
});
