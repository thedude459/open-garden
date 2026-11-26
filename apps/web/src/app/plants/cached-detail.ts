import type { PlantDetailDto } from '@open-garden/shared-types';

/** Details cached before companion pairs, varieties, or pests were listed lack those fields. */
export function withCompanionDefaults(detail: PlantDetailDto): PlantDetailDto {
  const stored: Partial<PlantDetailDto> = detail;
  return {
    ...detail,
    companions: stored.companions ?? [],
    companionZones: stored.companionZones ?? [],
    varieties: stored.varieties ?? [],
    pests: stored.pests ?? [],
  };
}
