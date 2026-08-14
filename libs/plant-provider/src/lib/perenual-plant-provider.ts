import type { PlantDataProvider, ProviderPlant } from './plant-data-provider';
import type { PlantType } from '@open-garden/shared-types';

/**
 * HTTP adapter for Perenual. Maps responses into ProviderPlant.
 * Requires PERENUAL_API_KEY. Never call this from feature libs directly —
 * wire via PlantDataProvider port only.
 */
export class PerenualPlantProvider implements PlantDataProvider {
  readonly id = 'perenual';

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = 'https://perenual.com/api',
  ) {
    if (!apiKey) {
      throw new Error('Perenual API key is required');
    }
  }

  async searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]> {
    const limit = options?.limit ?? 20;
    const url = new URL(`${this.baseUrl}/species-list`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('q', query);
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Perenual search failed: ${res.status}`);
    }
    const body = (await res.json()) as { data?: PerenualSpecies[] };
    return (body.data ?? []).slice(0, limit).map(mapSpecies);
  }

  async listPage(options?: { cursor?: string; limit?: number }) {
    const page = options?.cursor ? Number.parseInt(options.cursor, 10) : 1;
    const url = new URL(`${this.baseUrl}/species-list`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('page', String(page));
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Perenual list failed: ${res.status}`);
    }
    const body = (await res.json()) as { data?: PerenualSpecies[]; current_page?: number; last_page?: number };
    const items = (body.data ?? []).slice(0, options?.limit ?? 30).map(mapSpecies);
    const nextCursor =
      body.current_page && body.last_page && body.current_page < body.last_page
        ? String(body.current_page + 1)
        : undefined;
    return { items, nextCursor };
  }
}

interface PerenualSpecies {
  id: number;
  common_name?: string | null;
  scientific_name?: string[] | string | null;
  cycle?: string | null;
  sunlight?: string[] | string | null;
  watering?: string | null;
}

function mapSpecies(s: PerenualSpecies): ProviderPlant {
  const scientific = Array.isArray(s.scientific_name)
    ? s.scientific_name[0]
    : s.scientific_name;
  return {
    externalId: String(s.id),
    commonName: s.common_name?.trim() || scientific || `Species ${s.id}`,
    species: scientific || 'Unknown species',
    cultivar: null,
    plantType: inferType(s),
    zoneMin: 3,
    zoneMax: 9,
    sunRequirements: Array.isArray(s.sunlight) ? s.sunlight.join(', ') : (s.sunlight ?? null),
    waterNeeds: s.watering ?? null,
    daysToMaturity: null,
    spacingInches: null,
  };
}

function inferType(s: PerenualSpecies): PlantType {
  const cycle = (s.cycle ?? '').toLowerCase();
  if (cycle.includes('tree')) return 'tree';
  if (cycle.includes('herb')) return 'herb';
  return 'flower';
}
