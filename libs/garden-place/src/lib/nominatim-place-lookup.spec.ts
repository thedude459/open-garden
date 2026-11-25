import { describe, expect, it } from 'vitest';
import { NominatimPlaceLookup, type LookupClock } from './nominatim-place-lookup';

const street = [
  {
    display_name: '12 Main Street, Springfield',
    lat: '40.1',
    lon: '-89.6',
    osm_type: 'node',
    osm_id: 1,
    addresstype: 'house',
    address: { house_number: '12', country_code: 'us' },
  },
];

/** A clock that only moves when the lookup sleeps, and a fetch that records when it ran. */
function setup() {
  let now = 0;
  const startedAt: number[] = [];
  const clock: LookupClock = {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
  const fetchFn = (async () => {
    startedAt.push(now);
    return new Response(JSON.stringify(street), { status: 200 });
  }) as typeof fetch;
  return {
    lookup: new NominatimPlaceLookup(fetchFn, clock),
    startedAt,
    advance: (ms: number) => (now += ms),
  };
}

describe('NominatimPlaceLookup', () => {
  it('reads street-level results', async () => {
    const { lookup } = setup();
    const answer = await lookup.lookup('12 Main Street');
    expect(answer.candidates[0]).toMatchObject({ latitude: 40.1, longitude: -89.6 });
  });

  it('sends at most one request a second, as Nominatim asks', async () => {
    const { lookup, startedAt } = setup();
    await Promise.all([lookup.lookup('1 A St'), lookup.lookup('2 B St'), lookup.lookup('3 C St')]);
    expect(startedAt).toEqual([0, 1000, 2000]);
  });

  it('answers a repeated search from its cache for an hour', async () => {
    const { lookup, startedAt, advance } = setup();
    await lookup.lookup('12 Main Street');
    advance(59 * 60 * 1000);
    await lookup.lookup('  12 MAIN street ');
    expect(startedAt).toHaveLength(1);
    advance(2 * 60 * 1000);
    await lookup.lookup('12 Main Street');
    expect(startedAt).toHaveLength(2);
  });

  it('keeps the queue moving after a failed request', async () => {
    let calls = 0;
    const clock: LookupClock = { now: () => 0, sleep: async () => undefined };
    const fetchFn = (async () => {
      calls += 1;
      if (calls === 1) throw new Error('network down');
      return new Response(JSON.stringify(street), { status: 200 });
    }) as typeof fetch;
    const lookup = new NominatimPlaceLookup(fetchFn, clock);
    await expect(lookup.lookup('1 A St')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    await expect(lookup.lookup('2 B St')).resolves.toBeTruthy();
  });
});
