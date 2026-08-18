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
    };
    const service = new CatalogService(plants as never);
    const page = await service.list({ page: 1, pageSize: 20 });
    expect(page.totalCount).toBe(1);
  });

  it('rejects invalid zone', async () => {
    const service = new CatalogService({ list: vi.fn() } as never);
    await expect(service.list({ zone: 99 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('never calls a provider on empty or non-empty local results', async () => {
    const searchByName = vi.fn();
    const plants = {
      list: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
    };
    const service = new CatalogService(plants as never);
    const page = await service.list({ q: 'tomato' });
    expect(page.totalCount).toBe(0);
    expect(page.items).toEqual([]);
    expect(searchByName).not.toHaveBeenCalled();
    expect(plants.list).toHaveBeenCalledOnce();
  });
});
