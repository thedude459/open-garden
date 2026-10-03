import type { PlaceCandidateDto } from '@open-garden/shared-types';

export const WASHINGTON_QUERY = '1600 Pennsylvania Avenue NW, Washington, DC';

export const WASHINGTON_PLACE: PlaceCandidateDto = {
  formattedAddress: '1600 Pennsylvania Avenue NW, Washington, DC 20500, USA',
  latitude: 38.8977,
  longitude: -77.0365,
  placeId: 'fixture-washington',
  postalCode: '20500',
  countryCode: 'US',
};

export const MAIN_STREET_QUERY = '100 Main Street';

export const MAIN_STREET_PLACES: PlaceCandidateDto[] = [
  {
    formattedAddress: '100 Main Street, Springfield, IL 62701, USA',
    latitude: 39.799,
    longitude: -89.644,
    placeId: 'fixture-main-il',
    postalCode: '62701',
    countryCode: 'US',
  },
  {
    formattedAddress: '100 Main Street, Springfield, MA 01103, USA',
    latitude: 42.101,
    longitude: -72.59,
    placeId: 'fixture-main-ma',
    postalCode: '01103',
    countryCode: 'US',
  },
];

export function isWashingtonPoint(latitude: number, longitude: number): boolean {
  return (
    Math.abs(latitude - WASHINGTON_PLACE.latitude) < 0.0001 &&
    Math.abs(longitude - WASHINGTON_PLACE.longitude) < 0.0001
  );
}
