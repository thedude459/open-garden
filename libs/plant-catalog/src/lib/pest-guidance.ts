import type {
  CatalogPestDto,
  PestRegionDto,
  PestRegionMatch,
  PlantPestDto,
} from '@open-garden/shared-types';

/** One of the member's properties, as far as pest guidance needs it. */
export interface MemberPlace {
  /** ISO 3166-1 alpha-2; null for a property saved before its country was kept. */
  country: string | null;
  zone: number | null;
}

/**
 * The pests to show on a plant page, each with the regional guidance that
 * fits the member's properties (ADR 0045):
 *
 * - A pest whose countries are known and include none of the member's known
 *   countries is left out (no Colorado potato beetle for a garden in
 *   Ireland). One with unknown countries is kept.
 * - Guidance comes from a region in one of the member's countries, the one
 *   nearest their zones (`country`). When no property's country is known,
 *   from the region nearest their zones, labelled with where it is from
 *   (`nearest`). When their countries have guidance for none, no region:
 *   no timing or products from another country (`none`).
 */
export function pestsForPlaces(
  pests: readonly CatalogPestDto[],
  places: readonly MemberPlace[],
): PlantPestDto[] {
  const countries = new Set(places.flatMap((p) => (p.country ? [p.country] : [])));
  const zones = places.flatMap((p) => (p.zone == null ? [] : [p.zone]));
  const anyUnknown = places.length === 0 || places.some((p) => !p.country);
  return pests
    .filter(
      (pest) =>
        countries.size === 0 ||
        pest.occursIn === null ||
        pest.occursIn.some((c) => countries.has(c)),
    )
    .map((pest) => {
      const { region, regionMatch } = chooseRegion(pest.regions, countries, zones, anyUnknown);
      return {
        id: pest.id,
        name: pest.name,
        scientificName: pest.scientificName,
        kind: pest.kind,
        signs: pest.signs,
        scoutStages: pest.scoutStages,
        controls: pest.controls,
        region,
        regionMatch,
      };
    });
}

function chooseRegion(
  regions: readonly PestRegionDto[],
  countries: ReadonlySet<string>,
  zones: readonly number[],
  anyUnknown: boolean,
): { region: PestRegionDto | null; regionMatch: PestRegionMatch } {
  const local = regions.filter((r) => countries.has(r.country));
  if (local.length) return { region: nearest(local, zones), regionMatch: 'country' };
  if (anyUnknown && regions.length)
    return { region: nearest(regions, zones), regionMatch: 'nearest' };
  return { region: null, regionMatch: 'none' };
}

/** The region whose zones are fewest zones from any of these; the first on a tie or without zones. */
function nearest(regions: readonly PestRegionDto[], zones: readonly number[]): PestRegionDto {
  let best = regions[0]!;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const region of regions) {
    if (!region.zones) continue;
    for (const zone of zones) {
      const gap =
        zone < region.zones.min
          ? region.zones.min - zone
          : zone > region.zones.max
            ? zone - region.zones.max
            : 0;
      if (gap < bestGap) {
        best = region;
        bestGap = gap;
      }
    }
  }
  return best;
}
