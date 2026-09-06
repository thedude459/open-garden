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
            spacingInches: 12,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      }),
      upsertByVarietyKey: vi.fn(),
      upsertManyByVarietyKey: vi.fn(),
    };
    const provider = { id: 'fixture', searchByName: vi.fn(), listPage: vi.fn() };
    const service = new CatalogService(plants as never, provider as never);
    const page = await service.list({ page: 1, pageSize: 20 });
    expect(page.totalCount).toBe(1);
    expect(page.items[0]?.spacingInches).toBe(12);
    expect(page.items[0]?.illustrationUrl).toBeNull();
    expect(provider.searchByName).not.toHaveBeenCalled();
  });

  it('rejects invalid zone', async () => {
    const service = new CatalogService(
      { list: vi.fn(), upsertByVarietyKey: vi.fn(), upsertManyByVarietyKey: vi.fn() } as never,
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
              spacingInches: 24,
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }),
      upsertByVarietyKey: vi.fn(),
      upsertManyByVarietyKey: vi.fn(),
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
    expect(plants.upsertManyByVarietyKey).toHaveBeenCalledTimes(1);
    expect(plants.upsertByVarietyKey).not.toHaveBeenCalled();
    expect(page.totalCount).toBe(1);
    expect(page.items[0]?.illustrationUrl).toBeNull();
  });

  it('omits null-spacing rows from summaries', async () => {
    const plants = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: '1',
            commonName: 'Mystery',
            species: 'Unknown',
            cultivar: null,
            plantType: 'herb',
            zoneMin: 4,
            zoneMax: 10,
            spacingInches: null,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      }),
      upsertByVarietyKey: vi.fn(),
      upsertManyByVarietyKey: vi.fn(),
    };
    const service = new CatalogService(
      plants as never,
      { id: 'fixture', searchByName: vi.fn(), listPage: vi.fn() } as never,
    );
    const page = await service.list({});
    expect(page.items).toEqual([]);
  });

  it('does not miss-fill upsert when the provider hit has no spacing', async () => {
    const plants = {
      list: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
      upsertByVarietyKey: vi.fn(),
      upsertManyByVarietyKey: vi.fn(),
    };
    const provider = {
      id: 'fixture',
      searchByName: vi.fn().mockResolvedValue([
        {
          externalId: 'x',
          commonName: 'Gap',
          species: 'Gap sp',
          cultivar: null,
          plantType: 'herb',
          zoneMin: 4,
          zoneMax: 10,
          sunRequirements: null,
          waterNeeds: null,
          daysToMaturity: null,
          spacingInches: null,
        },
      ]),
      listPage: vi.fn(),
    };
    const service = new CatalogService(plants as never, provider as never);
    await service.list({ q: 'gap' });
    expect(plants.upsertByVarietyKey).not.toHaveBeenCalled();
    expect(plants.upsertManyByVarietyKey).toHaveBeenCalledTimes(1);
    expect(plants.upsertManyByVarietyKey).toHaveBeenCalledWith([]);
  });
});
