import { describe, expect, it, vi } from 'vitest';
import { CatalogSyncService } from './catalog-sync-service';
import type { ProviderPlant } from '@open-garden/plant-provider';

const sample: ProviderPlant = {
  externalId: '1',
  commonName: 'Basil',
  species: 'Ocimum basilicum',
  cultivar: null,
  plantType: 'herb',
  zoneMin: 4,
  zoneMax: 9,
  sunRequirements: 'full',
  waterNeeds: 'medium',
  daysToMaturity: 60,
  spacingInches: 12,
};

describe('CatalogSyncService', () => {
  it('upserts provider pages and marks sync succeeded', async () => {
    const upsertByVarietyKey = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateWhere,
        }),
      }),
    };
    const provider = {
      id: 'fixture',
      listPage: vi.fn().mockResolvedValue({ items: [sample], nextCursor: undefined }),
      searchByName: vi.fn(),
    };
    const svc = new CatalogSyncService(db as never, { upsertByVarietyKey } as never, provider);
    const result = await svc.runOperatorSync(10);
    expect(result).toEqual({ syncRunId: 'run-1', upserted: 1 });
    expect(upsertByVarietyKey).toHaveBeenCalledOnce();
    expect(updateWhere).toHaveBeenCalled();
  });

  it('marks sync failed when provider throws', async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'run-2' }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateWhere,
        }),
      }),
    };
    const provider = {
      id: 'fixture',
      listPage: vi.fn().mockRejectedValue(new Error('provider down')),
      searchByName: vi.fn(),
    };
    const svc = new CatalogSyncService(db as never, { upsertByVarietyKey: vi.fn() } as never, provider);
    await expect(svc.runOperatorSync()).rejects.toThrow('provider down');
    expect(updateWhere).toHaveBeenCalled();
  });
});
