import { describe, expect, it } from 'vitest';
import { FixtureClimateLookup, LiveClimateLookup, keepFrostPair, mmdd, zoneNumberFromLabel } from './climate';
import { MAIN_STREET_PLACES, WASHINGTON_PLACE } from './fixtures';

describe('climate rules', () => {
  it('reads the zone number and drops values outside 1–13', () => {
    expect(zoneNumberFromLabel('8a')).toBe(8);
    expect(zoneNumberFromLabel('10b')).toBe(10);
    expect(zoneNumberFromLabel('0')).toBeNull();
    expect(zoneNumberFromLabel('14')).toBeNull();
    expect(zoneNumberFromLabel('')).toBeNull();
  });

  it('keeps a spring-then-fall pair and drops a reversed or same-day pair', () => {
    expect(keepFrostPair({ month: 4, day: 15 }, { month: 10, day: 20 })).toEqual({
      last: { month: 4, day: 15 },
      first: { month: 10, day: 20 },
    });
    expect(keepFrostPair({ month: 10, day: 20 }, { month: 4, day: 15 })).toEqual({
      last: null,
      first: null,
    });
    expect(keepFrostPair({ month: 5, day: 1 }, { month: 5, day: 1 })).toEqual({
      last: null,
      first: null,
    });
    expect(keepFrostPair({ month: 4, day: 15 }, null)).toEqual({ last: null, first: null });
  });

  it('parses FarmSense MMDD', () => {
    expect(mmdd('0415')).toEqual({ month: 4, day: 15 });
    expect(mmdd('999')).toBeNull();
  });

  it('fills Washington and leaves another fixture coordinate empty', async () => {
    const climate = new FixtureClimateLookup();
    await expect(climate.lookup(WASHINGTON_PLACE)).resolves.toEqual({
      hardinessZone: 8,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
    });
    await expect(climate.lookup(MAIN_STREET_PLACES[0]!)).resolves.toEqual({
      hardinessZone: null,
      lastFrost: null,
      firstFrost: null,
    });
  });

  it('reads phzmapi and FarmSense without failing the place when frost is reversed', async () => {
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('phzmapi.org')) {
        return json({ zone: '8a' });
      }
      if (url.includes('/stations/')) {
        return json([{ id: 's1', distance: 2 }]);
      }
      if (url.includes('season=1')) return json([{ temperature: '32', prob_50: '1015' }]);
      if (url.includes('season=2')) return json([{ temperature: 32, prob_50: '0401' }]);
      throw new Error(url);
    }) as typeof fetch;
    const facts = await new LiveClimateLookup(fetchFn).lookup(WASHINGTON_PLACE);
    expect(facts).toEqual({ hardinessZone: 8, lastFrost: null, firstFrost: null });
  });
});

function json(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}
