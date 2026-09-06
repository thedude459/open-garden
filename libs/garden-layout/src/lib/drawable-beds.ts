import type { LayoutBedDto } from '@open-garden/shared-types';

export function drawableBeds(beds: LayoutBedDto[]): LayoutBedDto[] {
  return beds.filter((bed) => bed.geometry !== null);
}
