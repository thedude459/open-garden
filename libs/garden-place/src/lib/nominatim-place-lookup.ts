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

export class NominatimPlaceLookup implements PlaceLookup {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async lookup(query: string): Promise<PlaceLookupDto> {
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
