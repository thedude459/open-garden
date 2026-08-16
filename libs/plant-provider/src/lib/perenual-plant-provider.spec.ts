import { describe, expect, it, vi } from 'vitest';
import { PerenualPlantProvider } from './perenual-plant-provider';

describe('PerenualPlantProvider', () => {
  it('maps search results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 99,
            common_name: 'Lavender',
            scientific_name: ['Lavandula'],
            sunlight: ['full sun'],
            watering: 'Minimum',
          },
        ],
      }),
    });
    const provider = new PerenualPlantProvider('test-key', fetchImpl as unknown as typeof fetch);
    const results = await provider.searchByName('lavender');
    expect(results[0]?.commonName).toBe('Lavender');
    expect(results[0]?.species).toBe('Lavandula');
    expect(results[0]?.growingGuidance).toBeNull();
  });

  it('throws without api key', () => {
    expect(() => new PerenualPlantProvider('')).toThrow(/API key/);
  });

  it('lists pages with next cursor', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 1, common_name: 'Rose', scientific_name: 'Rosa', cycle: 'tree' }],
        current_page: 1,
        last_page: 2,
      }),
    });
    const provider = new PerenualPlantProvider('test-key', fetchImpl as unknown as typeof fetch);
    const page = await provider.listPage({ cursor: '1', limit: 10 });
    expect(page.items[0]?.plantType).toBe('tree');
    expect(page.nextCursor).toBe('2');
  });

  it('throws when list request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new PerenualPlantProvider('test-key', fetchImpl as unknown as typeof fetch);
    await expect(provider.listPage()).rejects.toThrow(/list failed/);
  });
});
