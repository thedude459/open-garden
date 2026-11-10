import { describe, expect, it } from 'vitest';
import { fetchAllFromProvider } from './fetch-all';
import { MemoryProvider, samplePlant } from './test-memory';

describe('fetchAllFromProvider', () => {
  it('pages until nextCursor is absent and does not stop at 500', async () => {
    const plants = Array.from({ length: 620 }, (_, i) =>
      samplePlant({
        externalId: `p-${i}`,
        commonName: `Plant ${i}`,
        species: `Species ${i}`,
      }),
    );
    const provider = new MemoryProvider('a', plants);
    const { plants: all, skipped } = await fetchAllFromProvider(provider);
    expect(all).toHaveLength(620);
    expect(skipped).toBe(0);
  });

  it('ends the source on an empty page', async () => {
    const provider: MemoryProvider = {
      id: 'empty',
      plants: [],
      searchByName: async () => [],
      listPage: async () => ({ items: [], nextCursor: '1' }),
    };
    const { plants: all } = await fetchAllFromProvider(provider);
    expect(all).toHaveLength(0);
  });

  it('adds up the records each page skipped', async () => {
    const pages = [
      { items: [samplePlant({ externalId: 'x' })], nextCursor: '1', skipped: 2 },
      { items: [samplePlant({ externalId: 'y' })], skipped: 1 },
    ];
    const provider: MemoryProvider = {
      id: 'partial',
      plants: [],
      searchByName: async () => [],
      listPage: async ({ cursor } = {}) => pages[cursor ? 1 : 0]!,
    };
    expect(await fetchAllFromProvider(provider)).toMatchObject({ skipped: 3 });
  });
});
