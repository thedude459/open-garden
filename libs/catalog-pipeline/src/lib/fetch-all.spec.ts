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
    const all = await fetchAllFromProvider(provider);
    expect(all).toHaveLength(620);
  });

  it('ends the source on an empty page', async () => {
    const provider: MemoryProvider = {
      id: 'empty',
      plants: [],
      searchByName: async () => [],
      listPage: async () => ({ items: [], nextCursor: '1' }),
    };
    const all = await fetchAllFromProvider(provider);
    expect(all).toHaveLength(0);
  });
});
