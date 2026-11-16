import type { PlantDetailDto } from '@open-garden/shared-types';

/** Details cached before companion pairs existed have neither field. */
export function withCompanionDefaults(detail: PlantDetailDto): PlantDetailDto {
  const stored: Partial<PlantDetailDto> = detail;
  return {
    ...detail,
    companions: stored.companions ?? [],
    companionZones: stored.companionZones ?? [],
  };
}
