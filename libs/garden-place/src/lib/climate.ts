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
 * ponytail: FarmSense's host no longer resolves, so frost comes from NOAA
 * 1991–2020 50% 32°F dates for the US ZIP. A failed response leaves frost unset.
 * Upgrade path: vendor those normals and look up the nearest station locally.
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
    if (place.countryCode !== 'US' || !/^\d{5}$/.test(place.postalCode ?? '')) {
      return { last: null, first: null };
    }
    try {
      const response = await this.fetchFn(`https://apis.joelgrant.dev/api/v1/frost/${place.postalCode}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return { last: null, first: null };
      const body = (await response.json()) as {
        data?: {
          frost_free?: boolean;
          frost_dates?: {
            last_frost_32f?: { '50%'?: string } | null;
            first_frost_32f?: { '50%'?: string } | null;
          } | null;
        };
      };
      if (body.data?.frost_free) return { last: null, first: null };
      return {
        last: mmdd(body.data?.frost_dates?.last_frost_32f?.['50%']?.replace('/', '')),
        first: mmdd(body.data?.frost_dates?.first_frost_32f?.['50%']?.replace('/', '')),
      };
    } catch {
      return { last: null, first: null };
    }
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
