import { describe, expect, it } from 'vitest';
import { FixturePlantProvider } from './fixture-plant-provider';

describe('FixturePlantProvider', () => {
  const provider = new FixturePlantProvider();

  it('searches by common name', async () => {
    const results = await provider.searchByName('tomato');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.commonName.toLowerCase()).toContain('tomato');
  });

  it('lists pages', async () => {
    const page = await provider.listPage({ limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeDefined();
  });
});
