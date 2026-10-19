import type { PlaceCandidateDto } from '@open-garden/shared-types';
import type { ClimateFacts, ClimateLookup, MonthDay } from './ports';

export function zoneNumberFromLabel(label: string | null | undefined): number | null {
  if (label == null || label.trim() === '') return null;
  const zone = Number.parseInt(label, 10);
  if (!Number.isInteger(zone) || zone < 1 || zone > 13) return null;
  return zone;
}

/** Last frost must fall earlier in the calendar year than first frost. Otherwise store neither. */
export function keepFrostPair(
  last: MonthDay | null,
  first: MonthDay | null,
): { last: MonthDay | null; first: MonthDay | null } {
  if (!last || !first) return { last: null, first: null };
  if (!validDay(last) || !validDay(first)) return { last: null, first: null };
  const lastKey = last.month * 100 + last.day;
  const firstKey = first.month * 100 + first.day;
  if (lastKey >= firstKey) return { last: null, first: null };
  return { last, first };
}

function validDay(value: MonthDay): boolean {
  return value.month >= 1 && value.month <= 12 && value.day >= 1 && value.day <= 31;
}

export class FixtureClimateLookup implements ClimateLookup {
  async lookup(place: PlaceCandidateDto): Promise<ClimateFacts> {
    if (place.countryCode === 'US' && place.postalCode === '20500') {
      return {
        hardinessZone: 8,
        lastFrost: { month: 4, day: 15 },
        firstFrost: { month: 10, day: 20 },
      };
    }
    return { hardinessZone: null, lastFrost: null, firstFrost: null };
  }
}

/**
 * ponytail: FarmSense's frost dataset and host are old. A failed station or
 * probability response leaves frost unset. Upgrade path: vendor NOAA 1991–2020
 * median 32°F normals and look up the nearest station locally.
 */
export class LiveClimateLookup implements ClimateLookup {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async lookup(place: PlaceCandidateDto): Promise<ClimateFacts> {
    const hardinessZone = await this.zone(place);
    const frost = await this.frost(place);
    const pair = keepFrostPair(frost.last, frost.first);
    return { hardinessZone, lastFrost: pair.last, firstFrost: pair.first };
  }

  private async zone(place: PlaceCandidateDto): Promise<number | null> {
    if (place.countryCode !== 'US' || !/^\d{5}$/.test(place.postalCode ?? '')) return null;
    try {
      const response = await this.fetchFn(`https://phzmapi.org/${place.postalCode}.json`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { zone?: string };
      return zoneNumberFromLabel(body.zone);
    } catch {
      return null;
    }
  }

  private async frost(place: PlaceCandidateDto): Promise<{ last: MonthDay | null; first: MonthDay | null }> {
    try {
      const stationsUrl = new URL('https://api.farmsense.net/v1/frostdates/stations/');
      stationsUrl.searchParams.set('lat', String(place.latitude));
      stationsUrl.searchParams.set('lon', String(place.longitude));
      const stationsRes = await this.fetchFn(stationsUrl, { signal: AbortSignal.timeout(3000) });
      if (!stationsRes.ok) return { last: null, first: null };
      const stations = (await stationsRes.json()) as Array<{ id?: string | number; distance?: number }>;
      const nearest = [...stations].sort(
        (a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY),
      )[0];
      if (nearest?.id == null) return { last: null, first: null };
      const last = await this.probability(nearest.id, 1);
      const first = await this.probability(nearest.id, 2);
      return { last, first };
    } catch {
      return { last: null, first: null };
    }
  }

  private async probability(stationId: string | number, season: 1 | 2): Promise<MonthDay | null> {
    const url = new URL('https://api.farmsense.net/v1/frostdates/probabilities/');
    url.searchParams.set('station', String(stationId));
    url.searchParams.set('season', String(season));
    const response = await this.fetchFn(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ temperature?: string | number; prob_50?: string }>;
    const row = rows.find((item) => Number(item.temperature) === 32);
    return mmdd(row?.prob_50);
  }
}

export function mmdd(value: string | undefined): MonthDay | null {
  if (!value || !/^\d{3,4}$/.test(value)) return null;
  const text = value.padStart(4, '0');
  const month = Number(text.slice(0, 2));
  const day = Number(text.slice(2));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}
