import type { CatalogCompanionDto, CompanionEvidence } from '@open-garden/shared-types';

const EVIDENCE_ORDER: Record<CompanionEvidence, number> = {
  research: 0,
  extension: 1,
  traditional: 2,
};

/**
 * How far a pair's evidence is from the given hardiness zones: 0 when it was
 * shown in one of them, else the fewest zones between. Infinity when it was
 * shown only in places without zones (a greenhouse) or no zones are given.
 */
export function zoneDistance(pair: CatalogCompanionDto, zones: readonly number[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const place of pair.shownIn) {
    if (!place.zones) continue;
    for (const zone of zones) {
      const gap =
        zone < place.zones.min
          ? place.zones.min - zone
          : zone > place.zones.max
            ? zone - place.zones.max
            : 0;
      best = Math.min(best, gap);
    }
  }
  return best;
}

/**
 * Pairs shown nearest the zones first, then stronger evidence, then by name.
 * Nothing is dropped: most pairs were tested in only one or two places (ADR 0030).
 */
export function rankCompanions<T extends CatalogCompanionDto>(
  pairs: readonly T[],
  zones: readonly number[],
): T[] {
  return [...pairs].sort(
    (a, b) =>
      zoneDistance(a, zones) - zoneDistance(b, zones) ||
      EVIDENCE_ORDER[a.evidence] - EVIDENCE_ORDER[b.evidence] ||
      a.name.localeCompare(b.name),
  );
}
