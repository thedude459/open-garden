import type { PlaceLookupDto } from '@open-garden/shared-types';
import {
  MAIN_STREET_PLACES,
  MAIN_STREET_QUERY,
  WASHINGTON_PLACE,
  WASHINGTON_QUERY,
} from './fixtures';
import { PLACE_NOT_FOUND_MESSAGE, PlaceLookupError, STREET_ADDRESS_MESSAGE, type PlaceLookup } from './ports';

export class FixturePlaceLookup implements PlaceLookup {
  async lookup(query: string): Promise<PlaceLookupDto> {
    const trimmed = query.trim();
    if (trimmed === WASHINGTON_QUERY) {
      return { candidates: [WASHINGTON_PLACE], truncated: false };
    }
    if (trimmed === MAIN_STREET_QUERY) {
      return { candidates: MAIN_STREET_PLACES, truncated: false };
    }
    if (trimmed === 'France') {
      throw new PlaceLookupError('VALIDATION_ERROR', STREET_ADDRESS_MESSAGE);
    }
    throw new PlaceLookupError('VALIDATION_ERROR', PLACE_NOT_FOUND_MESSAGE);
  }
}
