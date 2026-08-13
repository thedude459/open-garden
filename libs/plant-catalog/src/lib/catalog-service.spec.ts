import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog-service';

describe('CatalogService', () => {
  it('lists from repository without provider when results exist', async () => {
    const plants = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: '1',
            commonName: 'Basil',
            species: 'Ocimum basilicum',
            cultivar: null,
            plantType: 'herb',
            zoneMin: 4,
            zoneMax: 10,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      }),
      upsertByVarietyKey: vi.fn(),
    };
    const provider = { id: 'fixture', searchByName: vi.fn(), listPage: vi.fn() };
    const service = new CatalogService(plants as never, provider as never);
    const page = await service.list({ page: 1, pageSize: 20 });
    expect(page.totalCount).toBe(1);
    expect(provider.searchByName).not.toHaveBeenCalled();
  });

  it('rejects invalid zone', async () => {
    const service = new CatalogService(
      { list: vi.fn(), upsertByVarietyKey: vi.fn() } as never,
      { id: 'fixture', searchByName: vi.fn(), listPage: vi.fn() } as never,
    );
    await expect(service.list({ zone: 99 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('miss-fills when name search is empty locally', async () => {
    const plants = {
      list: vi
        .fn()
        .mockResolvedValueOnce({ items: [], totalCount: 0, page: 1, pageSize: 20 })
        .mockResolvedValueOnce({
          items: [
            {
              id: '2',
              commonName: 'Tomato',
              species: 'Solanum lycopersicum',
              cultivar: 'Cherry',
              plantType: 'vegetable',
              zoneMin: 4,
              zoneMax: 10,
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }),
      upsertByVarietyKey: vi.fn(),
    };
    const provider = {
      id: 'fixture',
      searchByName: vi.fn().mockResolvedValue([
        {
          externalId: 'x',
          commonName: 'Tomato',
          species: 'Solanum lycopersicum',
          cultivar: 'Cherry',
          plantType: 'vegetable',
          zoneMin: 4,
          zoneMax: 10,
          sunRequirements: null,
          waterNeeds: null,
          daysToMaturity: 65,
          spacingInches: 24,
        },
      ]),
      listPage: vi.fn(),
    };
    const service = new CatalogService(plants as never, provider as never);
    const page = await service.list({ q: 'tomato' });
    expect(provider.searchByName).toHaveBeenCalled();
    expect(plants.upsertByVarietyKey).toHaveBeenCalled();
    expect(page.totalCount).toBe(1);
  });
});
