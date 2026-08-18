import { describe, expect, it } from 'vitest';
import { FixturePlantProvider } from './fixture-plant-provider';

describe('FixturePlantProvider', () => {
  const provider = new FixturePlantProvider();

  it('searches by common name', async () => {
    const results = await provider.searchByName('tomato');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.commonName.toLowerCase()).toContain('tomato');
  });

  it('includes spinach, papaya zone range, maple without guidance, and unknown spacing', async () => {
    const spinach = (await provider.searchByName('spinach'))[0];
    expect(spinach?.growingGuidance?.outdoorSow?.frostAnchor).toBe('first');
    const papaya = (await provider.searchByName('papaya'))[0];
    expect(papaya?.plantType).toBe('fruit');
    expect(papaya?.zoneMin).toBe(9);
    expect(papaya?.zoneMax).toBe(11);
    const maple = (await provider.searchByName('red maple'))[0];
    expect(maple?.growingGuidance?.indoorStart).toBeNull();
    const unknown = (await provider.searchByName('unknown herb'))[0];
    expect(unknown?.spacingInches).toBeNull();
  });

  it('lists pages', async () => {
    const page = await provider.listPage({ limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeDefined();
  });

  it('lists at least 50 unique varieties including named catalog plants', async () => {
    const page = await provider.listPage({ limit: 100 });
    expect(page.items.length).toBeGreaterThanOrEqual(50);
    const names = new Set(page.items.map((p) => p.commonName));
    expect(names.has('Cherry Tomato')).toBe(true);
    expect(names.has('Sweet Basil')).toBe(true);
    expect(names.has('Interval Herb')).toBe(true);
    expect(names.size).toBe(page.items.length);
  });
});
