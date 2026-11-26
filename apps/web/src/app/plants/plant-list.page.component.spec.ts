import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PlantListQueryDto, PlantSummaryDto } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { GardensApiService } from '../gardens/gardens-api.service';
import { localIso } from '../today/today-groups';
import { PlantListPage } from './plant-list.page';
import { PlantsApiService } from './plants-api.service';
import { settled } from '../settled';

const basil: PlantSummaryDto = {
  id: 'p1',
  commonName: 'Basil',
  species: 'Ocimum basilicum',
  cultivar: null,
  plantType: 'herb',
  zoneMin: 4,
  zoneMax: 10,
  spacingInches: 12,
  illustrationUrl: null,
  family: 'Mint',
};

/** `items` is the whole catalog; the fake API serves it in pages. */
async function render(items: PlantSummaryDto[] = [basil]) {
  const list = vi.fn(async (q: PlantListQueryDto) => {
    const page = q.page ?? 1;
    const size = q.pageSize ?? 20;
    return {
      items: items.slice((page - 1) * size, page * size),
      page,
      pageSize: size,
      totalCount: items.length,
    };
  });
  TestBed.configureTestingModule({
    imports: [PlantListPage],
    providers: [
      provideRouter([]),
      {
        provide: PlantsApiService,
        useValue: { list, families: vi.fn(async () => ['Mint', 'Nightshade']) },
      },
      {
        provide: GardensApiService,
        useValue: {
          listAll: vi.fn(async () => ({
            items: [{ id: 'g1', name: 'Home' }],
            page: 1,
            pageSize: 100,
            totalCount: 1,
          })),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(PlantListPage);
  fixture.detectChanges();
  await settled(fixture);
  fixture.detectChanges();
  return {
    fixture,
    page: fixture.componentInstance,
    list,
    el: fixture.nativeElement as HTMLElement,
  };
}

describe('PlantListPage filters', () => {
  it('offers the catalog families and each property to sow at', async () => {
    const { el } = await render();
    const family = el.querySelector<HTMLSelectElement>('select[aria-label="Family"]')!;
    expect([...family.options].map((o) => o.textContent?.trim())).toEqual([
      'Any family',
      'Mint',
      'Nightshade',
    ]);
    const sow = el.querySelector<HTMLSelectElement>('select[aria-label="Can sow now"]')!;
    expect(sow.options[1]?.textContent?.trim()).toBe('Can sow this week at Home');
  });

  it('asks for a family and what can be sown now from today', async () => {
    const { page, list } = await render();
    page.family = 'Mint';
    page.sowNowFor = 'g1';
    await page.load();
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ family: 'Mint', sowNowFor: 'g1', asOf: localIso() }),
    );
  });

  it('says when nothing opens this week at the chosen property', async () => {
    const { fixture, page, el } = await render([]);
    page.sowNowFor = 'g1';
    await page.load();
    fixture.detectChanges();
    expect(el.textContent).toContain('Nothing opens to sow or plant there this week');
  });
});

describe('PlantListPage pages', () => {
  const catalog = Array.from({ length: 130 }, (_, i) => ({
    ...basil,
    id: `p${i}`,
    commonName: `Plant ${i}`,
  }));

  it('shows the first 100 and adds the rest with Show more', async () => {
    const { fixture, el, list } = await render(catalog);
    expect(el.querySelectorAll('a.row')).toHaveLength(100);
    expect(el.textContent).toContain('Showing 100 of 130.');

    const more = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Show more'),
    )!;
    more.click();
    await settled(fixture);
    fixture.detectChanges();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 100 }));
    expect(el.querySelectorAll('a.row')).toHaveLength(130);
    expect(el.textContent).not.toContain('Show more');
  });

  it('starts again from the first page when a filter changes', async () => {
    const { fixture, page, el } = await render(catalog);
    await page.more();
    page.family = 'Mint';
    await page.load();
    fixture.detectChanges();
    expect(el.querySelectorAll('a.row')).toHaveLength(100);
  });

  it('offers no Show more when everything fits', async () => {
    const { el } = await render();
    expect(el.textContent).not.toContain('Show more');
  });
});
