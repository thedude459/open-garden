import { describe, expect, it } from 'vitest';
import { FixtureBPlantProvider } from './fixture-b-plant-provider';

describe('FixtureBPlantProvider', () => {
  const provider = new FixtureBPlantProvider();

  it('has 10 overlap keys with fixture extras and 10 unique varieties', async () => {
    const page = await provider.listPage({ limit: 50 });
    expect(page.items).toHaveLength(20);
    const overlap = page.items.filter((p) => p.commonName.startsWith('Pipeline Extra'));
    const unique = page.items.filter((p) => p.commonName.startsWith('Pipeline Bravo'));
    expect(overlap).toHaveLength(10);
    expect(unique).toHaveLength(10);
    expect(overlap[0]?.waterNeeds).toBe('High');
    expect(overlap[0]?.species).toBe('Brassica pipeline 01');
  });

  it('searches by name, species, or cultivar, and lists the first page when empty', async () => {
    expect((await provider.searchByName('bravo 03')).map((p) => p.commonName)).toEqual([
      'Pipeline Bravo 03',
    ]);
    expect(await provider.searchByName('brassica pipeline', { limit: 3 })).toHaveLength(3);
    expect(await provider.searchByName('  ', { limit: 5 })).toHaveLength(5);
  });
});
