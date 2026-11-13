import type { PlaceCandidateDto, PlaceLookupDto } from '@open-garden/shared-types';

export interface MonthDay {
  month: number;
  day: number;
}

export interface ClimateFacts {
  hardinessZone: number | null;
  lastFrost: MonthDay | null;
  firstFrost: MonthDay | null;
  /** Mean daily temperature in each month, January first, °C; null when unknown. */
  monthlyMeanC: number[] | null;
  /** Dates frost passes in 9 years out of 10; only with both median frost dates. */
  frostRisk?: FrostRisk | null;
}

/**
 * The 1-in-10 frost dates: a frost after `lateLastFrost` comes in one spring
 * in ten, and one before `earlyFirstFrost` in one autumn in ten.
 */
export interface FrostRisk {
  lateLastFrost: MonthDay;
  earlyFirstFrost: MonthDay;
}

export interface PlaceLookup {
  lookup(query: string): Promise<PlaceLookupDto>;
}

export interface ClimateLookup {
  lookup(place: PlaceCandidateDto): Promise<ClimateFacts>;
}

export interface RainOutlook {
  /** Millimeters of rain keyed by YYYY-MM-DD. Null when the forecast cannot be read. */
  daily(latitude: number, longitude: number, asOf: string): Promise<Record<string, number> | null>;
}

export class PlaceLookupError extends Error {
  readonly code: 'VALIDATION_ERROR' | 'SERVICE_UNAVAILABLE';

  constructor(code: 'VALIDATION_ERROR' | 'SERVICE_UNAVAILABLE', message: string) {
    super(message);
    this.name = 'PlaceLookupError';
    this.code = code;
  }
}

export const STREET_ADDRESS_MESSAGE =
  'Type a street address. A city, region, or country is not a garden site.';
export const PLACE_NOT_FOUND_MESSAGE = 'That address could not be found';
export const PLACE_UNAVAILABLE_MESSAGE =
  'Place lookup is unavailable. Try again when you are online.';
