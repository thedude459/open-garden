// The catalog list's caches: a remembered first page answers filters while
// the network catches up, but never a later page. IndexedDB is not in the
// test browser, so the cache keeps lists in memory here.
import { afterEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { PageDto, PlantSummaryDto } from '@open-garden/shared-types';
import { PlantCatalogCacheService } from './plant-catalog-cache.service';
import { PlantsApiService } from './plants-api.service';

const plant = (id: string): PlantSummaryDto => ({
  id,
  commonName: `Plant ${id}`,
  species: 'Species',
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 3,
  zoneMax: 10,
  spacingInches: 12,
  illustrationUrl: null,
});

const page = (n: number, ids: string[]): PageDto<PlantSummaryDto> => ({
  items: ids.map(plant),
  page: n,
  pageSize: 2,
  totalCount: 3,
});

class MemoryCache extends PlantCatalogCacheService {
  readonly lists = new Map<string, PageDto<PlantSummaryDto>>();
  override async saveList(key: string, p: PageDto<PlantSummaryDto>) {
    this.lists.set(key, p);
  }
  override async getList(key: string) {
    return this.lists.get(key) ?? null;
  }
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PlantCatalogCacheService, useClass: MemoryCache },
    ],
  });
  return {
    api: TestBed.inject(PlantsApiService),
    http: TestBed.inject(HttpTestingController),
  };
}

/** Lets the service reach its HTTP call past the awaited cache lookups. */
const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('PlantsApiService list pages', () => {
  it('asks the server for a later page instead of repeating the first', async () => {
    const { api, http } = setup();
    const first = api.list({ page: 1, pageSize: 2 });
    await settle();
    http.expectOne((r) => r.params.get('page') === '1').flush(page(1, ['a', 'b']));
    expect((await first).items.map((p) => p.id)).toEqual(['a', 'b']);

    const second = api.list({ page: 2, pageSize: 2 });
    await settle();
    http.expectOne((r) => r.params.get('page') === '2').flush(page(2, ['c']));
    expect((await second).items.map((p) => p.id)).toEqual(['c']);
  });

  it('offline, has nothing for a later page rather than the first again', async () => {
    const { api, http } = setup();
    const first = api.list({ page: 1, pageSize: 2 });
    await settle();
    http.expectOne((r) => r.params.get('page') === '1').flush(page(1, ['a', 'b']));
    await first;

    const second = api.list({ page: 2, pageSize: 2 });
    await settle();
    http
      .expectOne((r) => r.params.get('page') === '2')
      .error(new ProgressEvent('error'), { status: 0 });
    expect((await second).items).toEqual([]);
  });

  it('answers a filter from a remembered page that holds the whole catalog', async () => {
    const { api, http } = setup();
    const first = api.list({ page: 1, pageSize: 2 });
    await settle();
    http.expectOne(() => true).flush({ ...page(1, ['a', 'b']), totalCount: 2 });
    await first;

    const zoned = await api.list({ page: 1, pageSize: 2, zone: 5 });
    expect(zoned.items.map((p) => p.id)).toEqual(['a', 'b']);
    await settle();
    http.expectOne((r) => r.params.get('zone') === '5').flush(page(1, ['a']));
  });

  it('asks the server when the remembered page is only part of the catalog', async () => {
    const { api, http } = setup();
    const first = api.list({ page: 1, pageSize: 2 });
    await settle();
    http.expectOne(() => true).flush(page(1, ['a', 'b']));
    await first;

    // Filtering two of three entries would miss a match on the page not held.
    const family = api.list({ page: 1, pageSize: 2, family: 'Cabbage family' });
    await settle();
    http.expectOne((r) => r.params.get('family') === 'Cabbage family').flush(page(1, ['c']));
    expect((await family).items.map((p) => p.id)).toEqual(['c']);
  });
});
