import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog-service';

describe('CatalogService', () => {
  it('lists from the repository', async () => {
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
    const service = new CatalogService(plants as never);
    const page = await service.list({ page: 1, pageSize: 20 });
    expect(page.totalCount).toBe(1);
    expect(page.items[0]?.spacingInches).toBe(12);
    expect(page.items[0]?.illustrationUrl).toBeNull();
  });

  it('rejects invalid zone', async () => {
    const service = new CatalogService({ list: vi.fn() } as never);
    await expect(service.list({ zone: 99 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
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
    const service = new CatalogService(plants as never);
    const page = await service.list({});
    expect(page.items).toEqual([]);
  });
});
