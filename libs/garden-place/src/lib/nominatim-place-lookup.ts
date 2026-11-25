import type { PlaceCandidateDto, PlaceLookupDto } from '@open-garden/shared-types';
import {
  PLACE_NOT_FOUND_MESSAGE,
  PLACE_UNAVAILABLE_MESSAGE,
  PlaceLookupError,
  STREET_ADDRESS_MESSAGE,
  type PlaceLookup,
} from './ports';

const USER_AGENT = 'OpenGarden/1.0 (garden place lookup)';

interface NominatimAddress {
  house_number?: string;
  postcode?: string;
  country_code?: string;
}

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  osm_type?: string;
  osm_id?: number;
  addresstype?: string;
  address?: NominatimAddress;
}

/** Nominatim's usage policy: at most one request a second, and cache results. */
const MIN_GAP_MS = 1000;
const CACHE_MS = 60 * 60 * 1000;
const CACHE_ENTRIES = 200;

export interface LookupClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: LookupClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class NominatimPlaceLookup implements PlaceLookup {
  /** Answers by query, newest last, so the oldest is dropped first. */
  private readonly cache = new Map<string, { at: number; answer: PlaceLookupDto }>();
  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = -Infinity;

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly clock: LookupClock = realClock,
  ) {}

  async lookup(query: string): Promise<PlaceLookupDto> {
    const key = query.trim().toLowerCase();
    const cached = this.cache.get(key);
    if (cached && this.clock.now() - cached.at < CACHE_MS) return cached.answer;
    const answer = await this.inTurn(() => this.search(query));
    this.cache.delete(key);
    this.cache.set(key, { at: this.clock.now(), answer });
    if (this.cache.size > CACHE_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    return answer;
  }

  /**
   * Runs one request at a time, at least a second after the last began.
   * ponytail: an unbounded queue; a burst of N lookups waits N seconds. Fine
   * for a household typing an address; cap it if many members share a server.
   */
  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const turn = this.queue.then(async () => {
      const wait = this.lastRequestAt + MIN_GAP_MS - this.clock.now();
      if (wait > 0) await this.clock.sleep(wait);
      this.lastRequestAt = this.clock.now();
      return work();
    });
    this.queue = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }

  private async search(query: string): Promise<PlaceLookupDto> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '10');
    url.searchParams.set('q', query.trim());
    let payload: unknown;
    try {
      const response = await this.fetchFn(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        throw new Error(`nominatim ${response.status}`);
      }
      payload = await response.json();
    } catch (err) {
      if (err instanceof PlaceLookupError) throw err;
      throw new PlaceLookupError('SERVICE_UNAVAILABLE', PLACE_UNAVAILABLE_MESSAGE);
    }
    if (!Array.isArray(payload)) {
      throw new PlaceLookupError('SERVICE_UNAVAILABLE', PLACE_UNAVAILABLE_MESSAGE);
    }
    const results = payload as NominatimResult[];
    if (results.length === 0) {
      throw new PlaceLookupError('VALIDATION_ERROR', PLACE_NOT_FOUND_MESSAGE);
    }
    const street = results.filter(isStreetLevel);
    if (street.length === 0) {
      throw new PlaceLookupError('VALIDATION_ERROR', STREET_ADDRESS_MESSAGE);
    }
    return {
      candidates: street.slice(0, 5).map(toCandidate),
      truncated: street.length > 5,
    };
  }
}

function isStreetLevel(result: NominatimResult): boolean {
  const house = result.address?.house_number?.trim();
  if (house) return true;
  return result.addresstype === 'house' || result.addresstype === 'building';
}

function toCandidate(result: NominatimResult): PlaceCandidateDto {
  const country = result.address?.country_code?.trim();
  return {
    formattedAddress: result.display_name ?? '',
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    placeId: `${result.osm_type ?? ''}/${result.osm_id ?? ''}`,
    postalCode: result.address?.postcode?.trim() ? result.address.postcode : null,
    countryCode: country ? country.toUpperCase() : null,
  };
}
