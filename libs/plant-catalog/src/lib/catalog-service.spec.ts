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

  it('narrows by a check the database cannot run, paging what is left', async () => {
    const row = (id: string, family: string) => ({
      id,
      commonName: id,
      species: id,
      cultivar: null,
      plantType: 'vegetable',
      zoneMin: 1,
      zoneMax: 13,
      spacingInches: 12,
      family,
    });
    const plants = {
      list: vi.fn().mockResolvedValue({
        items: [row('a', 'Nightshade'), row('b', 'Mint'), row('c', 'Nightshade')],
        totalCount: 3,
        page: 1,
        pageSize: 100_000,
      }),
    };
    const service = new CatalogService(plants as never);
    const page = await service.list(
      { family: ' Nightshade ', page: 2, pageSize: 1 },
      (r) => r.family === 'Nightshade',
    );
    expect(plants.list).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'Nightshade', page: 1 }),
    );
    expect(page).toMatchObject({ page: 2, pageSize: 1, totalCount: 2 });
    expect(page.items.map((p) => p.id)).toEqual(['c']);
  });

  it('lists the catalog families', async () => {
    const service = new CatalogService({
      families: vi.fn().mockResolvedValue(['Mint', 'Nightshade']),
    } as never);
    await expect(service.families()).resolves.toEqual(['Mint', 'Nightshade']);
  });

  it('rejects invalid zone', async () => {
    const service = new CatalogService({ list: vi.fn() } as never);
    await expect(service.list({ zone: 99 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects an unknown plant type', async () => {
    const service = new CatalogService({ list: vi.fn() } as never);
    await expect(service.list({ plantType: 'cactus' as never })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'invalid plantType',
    });
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
