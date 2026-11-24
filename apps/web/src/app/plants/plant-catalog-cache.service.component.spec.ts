import type { PageDto, PlantSummaryDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { PlantCatalogCacheService } from './plant-catalog-cache.service';

const plant = (id: string, plantType: PlantSummaryDto['plantType']) =>
  ({ id, commonName: id, species: id, cultivar: null, plantType }) as PlantSummaryDto;

describe('PlantCatalogCacheService.filterCached', () => {
  it('keeps only what an area takes, so a vegetable bed sees no grapevine', () => {
    const page: PageDto<PlantSummaryDto> = {
      items: [plant('kale', 'vegetable'), plant('grape', 'vine'), plant('apple', 'tree')],
      page: 1,
      pageSize: 20,
      totalCount: 3,
    };
    const cache = new PlantCatalogCacheService();
    expect(cache.filterCached(page, { area: 'vegetable' }).items.map((p) => p.id)).toEqual([
      'kale',
    ]);
    expect(cache.filterCached(page, { area: 'fruit' }).totalCount).toBe(3);
  });
});
