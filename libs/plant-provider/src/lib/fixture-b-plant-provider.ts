import type { PlantDataProvider, ProviderPlant } from './plant-data-provider';

/** Overlaps fixture extras 01–10 (same species+cultivar, conflicting attrs). */
const OVERLAP: ProviderPlant[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    externalId: `fix-b-overlap-${n}`,
    commonName: `Pipeline Extra ${n}`,
    species: `Brassica pipeline ${n}`,
    cultivar: null,
    plantType: 'vegetable' as const,
    zoneMin: 3,
    zoneMax: 9,
    sunRequirements: 'Part shade',
    waterNeeds: 'High',
    daysToMaturity: 99,
    spacingInches: 18,
  };
});

/** Unique to fixture-b. */
const UNIQUE: ProviderPlant[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    externalId: `fix-b-unique-${n}`,
    commonName: `Pipeline Bravo ${n}`,
    species: `Lactuca bravo ${n}`,
    cultivar: null,
    plantType: 'vegetable' as const,
    zoneMin: 4,
    zoneMax: 8,
    sunRequirements: 'Full sun',
    waterNeeds: 'Moderate',
    daysToMaturity: 40 + i,
    spacingInches: 8,
  };
});

export const FIXTURE_B_UNIQUE_NAME = 'Pipeline Bravo 01';

const PLANTS: ProviderPlant[] = [...OVERLAP, ...UNIQUE];

export class FixtureBPlantProvider implements PlantDataProvider {
  readonly id = 'fixture-b';

  async searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]> {
    const q = query.trim().toLowerCase();
    const limit = options?.limit ?? 20;
    if (!q) return PLANTS.slice(0, limit);
    return PLANTS.filter(
      (p) =>
        p.commonName.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (p.cultivar?.toLowerCase().includes(q) ?? false),
    ).slice(0, limit);
  }

  async listPage(options?: { cursor?: string; limit?: number }) {
    const limit = options?.limit ?? 50;
    const start = options?.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = PLANTS.slice(start, start + limit);
    const next = start + limit;
    return {
      items,
      nextCursor: next < PLANTS.length ? String(next) : undefined,
    };
  }
}
