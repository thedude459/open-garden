import { describe, expect, it, vi } from 'vitest';
import { FavoritesService } from './favorites-service';

describe('FavoritesService', () => {
  it('rejects add when plant missing', async () => {
    const plants = { getById: vi.fn().mockResolvedValue(null) };
    const favorites = { add: vi.fn(), remove: vi.fn(), listForUser: vi.fn(), isFavorite: vi.fn() };
    const service = new FavoritesService(favorites as never, plants as never);
    await expect(service.add('u1', 'p1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('adds idempotently when plant exists', async () => {
    const plants = { getById: vi.fn().mockResolvedValue({ id: 'p1' }) };
    const favorites = {
      add: vi.fn().mockResolvedValue({
        id: 'f1',
        plantId: 'p1',
        createdAt: new Date('2026-08-01T00:00:00Z'),
      }),
      remove: vi.fn(),
      listForUser: vi.fn().mockResolvedValue({
        items: [
          {
            favoriteId: 'f1',
            createdAt: new Date('2026-08-01T00:00:00Z'),
            plant: {
              id: 'p1',
              commonName: 'Basil',
              species: 'Ocimum basilicum',
              cultivar: null,
              plantType: 'herb',
              zoneMin: 4,
              zoneMax: 10,
              status: 'active',
            },
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      }),
      isFavorite: vi.fn(),
    };
    const service = new FavoritesService(favorites as never, plants as never);
    const result = await service.add('u1', 'p1', 'm1');
    expect(result.favoriteId).toBe('f1');
    expect(favorites.add).toHaveBeenCalledWith('u1', 'p1', 'm1');
    const list = await service.list('u1');
    expect(list.totalCount).toBe(1);
    await service.remove('u1', 'p1');
    expect(favorites.remove).toHaveBeenCalledWith('u1', 'p1');
  });
});
