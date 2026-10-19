import { describe, expect, it, vi } from 'vitest';
import { embedMapReachable, embedMapUrl } from './embed-map';
import { WASHINGTON_PLACE } from './fixtures';
import { FixturePlaceLookup } from './fixture-place-lookup';
import { NominatimPlaceLookup } from './nominatim-place-lookup';
import { PLACE_NOT_FOUND_MESSAGE, PLACE_UNAVAILABLE_MESSAGE, STREET_ADDRESS_MESSAGE } from './ports';

describe('FixturePlaceLookup', () => {
  const lookup = new FixturePlaceLookup();

  it('returns one Washington street candidate', async () => {
    const result = await lookup.lookup('1600 Pennsylvania Avenue NW, Washington, DC');
    expect(result.truncated).toBe(false);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      postalCode: '20500',
      countryCode: 'US',
      latitude: WASHINGTON_PLACE.latitude,
      longitude: WASHINGTON_PLACE.longitude,
    });
    const lat = result.candidates[0]!.latitude;
    const lng = result.candidates[0]!.longitude;
    const pad = 0.005;
    const src = embedMapUrl(lat, lng);
    expect(src).toBe(
      `https://www.openstreetmap.org/export/embed.html?bbox=${lng - pad},${lat - pad},${lng + pad},${lat + pad}&layer=mapnik&marker=${lat},${lng}`,
    );
    expect(src).not.toMatch(/key=|google/i);
  });

  it('treats a failed embed fetch as unreachable', async () => {
    const url = embedMapUrl(1, 2);
    const ok = vi.fn(async () => new Response(null, { status: 200 }));
    const failed = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(embedMapReachable(url, ok)).resolves.toBe(true);
    await expect(embedMapReachable(url, failed)).resolves.toBe(false);
    expect(ok).toHaveBeenCalledWith(url, { mode: 'no-cors', cache: 'no-store' });
  });

  it('returns two Main Street candidates', async () => {
    const result = await lookup.lookup('100 Main Street');
    expect(result.truncated).toBe(false);
    expect(result.candidates).toHaveLength(2);
    for (const candidate of result.candidates) {
      expect(candidate.latitude).not.toBe(WASHINGTON_PLACE.latitude);
    }
  });

  it('rejects a country query', async () => {
    await expect(lookup.lookup('France')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: STREET_ADDRESS_MESSAGE,
    });
  });

  it('rejects an unknown address', async () => {
    await expect(lookup.lookup('Nowhere')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: PLACE_NOT_FOUND_MESSAGE,
    });
  });
});

describe('NominatimPlaceLookup', () => {
  function jsonResponse(body: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    } as Response;
  }

  function hit(over: Record<string, unknown> = {}) {
    return {
      display_name: '1 Road',
      lat: '3',
      lon: '4',
      osm_type: 'way',
      osm_id: 99,
      addresstype: 'house',
      address: { house_number: '1', postcode: '12345', country_code: 'us' },
      ...over,
    };
  }

  it('keeps a house number and drops a city', async () => {
    let seen = '';
    let userAgent = '';
    const lookup = new NominatimPlaceLookup(async (url, init) => {
      seen = String(url);
      const headers = new Headers(init?.headers);
      userAgent = headers.get('User-Agent') ?? '';
      return jsonResponse([
        hit({
          display_name: 'Paris',
          lat: '1',
          lon: '2',
          osm_type: 'relation',
          osm_id: 1,
          addresstype: 'city',
          address: {},
        }),
        hit(),
      ]);
    });
    const found = await lookup.lookup('1 Road');
    expect(seen).toContain('nominatim.openstreetmap.org/search');
    expect(seen).toContain('limit=10');
    expect(userAgent).toBe('OpenGarden/1.0 (garden place lookup)');
    expect(found.truncated).toBe(false);
    expect(found.candidates).toEqual([
      {
        formattedAddress: '1 Road',
        latitude: 3,
        longitude: 4,
        placeId: 'way/99',
        postalCode: '12345',
        countryCode: 'US',
      },
    ]);
  });

  it('rejects when every result is coarse', async () => {
    const lookup = new NominatimPlaceLookup(async () =>
      jsonResponse([hit({ addresstype: 'city', address: { country_code: 'fr' } })]),
    );
    await expect(lookup.lookup('Paris')).rejects.toMatchObject({ message: STREET_ADDRESS_MESSAGE });
  });

  it('caps five street results and ignores a full page of mixed results', async () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      hit({ display_name: `Door ${i}`, osm_id: i, lat: String(i), lon: String(i) }),
    );
    const capped = new NominatimPlaceLookup(async () => jsonResponse(six));
    const found = await capped.lookup('Door');
    expect(found.candidates).toHaveLength(5);
    expect(found.truncated).toBe(true);

    const mixed = [
      ...Array.from({ length: 8 }, (_, i) =>
        hit({ addresstype: 'city', address: {}, osm_id: 100 + i, display_name: `City ${i}` }),
      ),
      hit({ osm_id: 1, display_name: 'A' }),
      hit({ osm_id: 2, display_name: 'B' }),
    ];
    const page = new NominatimPlaceLookup(async () => jsonResponse(mixed));
    const short = await page.lookup('Main');
    expect(short.candidates).toHaveLength(2);
    expect(short.truncated).toBe(false);
  });

  it('maps zero results and a failed request', async () => {
    const empty = new NominatimPlaceLookup(async () => jsonResponse([]));
    await expect(empty.lookup('Nope')).rejects.toMatchObject({ message: PLACE_NOT_FOUND_MESSAGE });
    const down = new NominatimPlaceLookup(async () => jsonResponse({}, false));
    await expect(down.lookup('Nope')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: PLACE_UNAVAILABLE_MESSAGE,
    });
  });
});
