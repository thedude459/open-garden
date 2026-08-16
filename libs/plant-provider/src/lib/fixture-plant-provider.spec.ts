import { describe, expect, it } from 'vitest';
import { FixturePlantProvider } from './fixture-plant-provider';

describe('FixturePlantProvider', () => {
  const provider = new FixturePlantProvider();

  it('searches by common name', async () => {
    const results = await provider.searchByName('tomato');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.commonName.toLowerCase()).toContain('tomato');
  });

  it('includes spinach, papaya zone range, and maple without guidance', async () => {
    const spinach = (await provider.searchByName('spinach'))[0];
    expect(spinach?.growingGuidance?.outdoorSow?.frostAnchor).toBe('first');
    const papaya = (await provider.searchByName('papaya'))[0];
    expect(papaya?.plantType).toBe('fruit');
    expect(papaya?.zoneMin).toBe(9);
    expect(papaya?.zoneMax).toBe(11);
    const maple = (await provider.searchByName('red maple'))[0];
    expect(maple?.growingGuidance?.indoorStart).toBeNull();
  });

  it('lists pages', async () => {
    const page = await provider.listPage({ limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeDefined();
  });
});
