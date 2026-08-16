import type { PlantDataProvider, ProviderPlant } from './plant-data-provider';

const FIXTURES: ProviderPlant[] = [
  {
    externalId: 'fix-tomato-cherry',
    commonName: 'Cherry Tomato',
    species: 'Solanum lycopersicum',
    cultivar: 'Cherry',
    plantType: 'vegetable',
    zoneMin: 4,
    zoneMax: 10,
    sunRequirements: 'Full sun',
    waterNeeds: 'Moderate',
    daysToMaturity: 65,
    spacingInches: 24,
    growingGuidance: {
      indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
      outdoorSow: null,
      transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 2 },
    },
  },
  {
    externalId: 'fix-basil-genovese',
    commonName: 'Sweet Basil',
    species: 'Ocimum basilicum',
    cultivar: 'Genovese',
    plantType: 'herb',
    zoneMin: 4,
    zoneMax: 10,
    sunRequirements: 'Full sun',
    waterNeeds: 'Moderate',
    daysToMaturity: 60,
    spacingInches: 12,
    growingGuidance: {
      indoorStart: { frostAnchor: 'last', weeksEarliest: -6, weeksLatest: -4 },
      outdoorSow: null,
      transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 2 },
    },
  },
  {
    externalId: 'fix-marigold',
    commonName: 'French Marigold',
    species: 'Tagetes patula',
    cultivar: null,
    plantType: 'flower',
    zoneMin: 2,
    zoneMax: 11,
    sunRequirements: 'Full sun',
    waterNeeds: 'Low',
    daysToMaturity: 50,
    spacingInches: 10,
    growingGuidance: {
      indoorStart: null,
      outdoorSow: { frostAnchor: 'last', weeksEarliest: 0, weeksLatest: 2 },
      transplant: null,
    },
  },
  {
    externalId: 'fix-apple-honeycrisp',
    commonName: 'Honeycrisp Apple',
    species: 'Malus domestica',
    cultivar: 'Honeycrisp',
    plantType: 'fruit',
    zoneMin: 3,
    zoneMax: 7,
    sunRequirements: 'Full sun',
    waterNeeds: 'Moderate',
    daysToMaturity: null,
    spacingInches: 144,
  },
  {
    externalId: 'fix-blueberry',
    commonName: 'Highbush Blueberry',
    species: 'Vaccinium corymbosum',
    cultivar: null,
    plantType: 'shrub',
    zoneMin: 4,
    zoneMax: 7,
    sunRequirements: 'Full sun',
    waterNeeds: 'High',
    daysToMaturity: null,
    spacingInches: 48,
  },
  {
    externalId: 'fix-maple',
    commonName: 'Red Maple',
    species: 'Acer rubrum',
    cultivar: null,
    plantType: 'tree',
    zoneMin: 3,
    zoneMax: 9,
    sunRequirements: 'Full sun to part shade',
    waterNeeds: 'Moderate',
    daysToMaturity: null,
    spacingInches: 360,
    growingGuidance: {
      indoorStart: null,
      outdoorSow: null,
      transplant: null,
    },
  },
  {
    externalId: 'fix-spinach',
    commonName: 'Spinach',
    species: 'Spinacia oleracea',
    cultivar: null,
    plantType: 'vegetable',
    zoneMin: 3,
    zoneMax: 9,
    sunRequirements: 'Full sun to part shade',
    waterNeeds: 'Moderate',
    daysToMaturity: 45,
    spacingInches: 6,
    growingGuidance: {
      indoorStart: null,
      outdoorSow: { frostAnchor: 'first', weeksEarliest: -8, weeksLatest: -6 },
      transplant: null,
    },
  },
  {
    externalId: 'fix-papaya',
    commonName: 'Papaya',
    species: 'Carica papaya',
    cultivar: null,
    plantType: 'fruit',
    zoneMin: 9,
    zoneMax: 11,
    sunRequirements: 'Full sun',
    waterNeeds: 'High',
    daysToMaturity: null,
    spacingInches: 96,
    growingGuidance: {
      indoorStart: null,
      outdoorSow: null,
      transplant: null,
    },
  },
];

export class FixturePlantProvider implements PlantDataProvider {
  readonly id = 'fixture';

  async searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]> {
    const q = query.trim().toLowerCase();
    const limit = options?.limit ?? 20;
    if (!q) {
      return FIXTURES.slice(0, limit);
    }
    return FIXTURES.filter(
      (p) =>
        p.commonName.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (p.cultivar?.toLowerCase().includes(q) ?? false),
    ).slice(0, limit);
  }

  async listPage(options?: { cursor?: string; limit?: number }) {
    const limit = options?.limit ?? 50;
    const start = options?.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = FIXTURES.slice(start, start + limit);
    const next = start + limit;
    return {
      items,
      nextCursor: next < FIXTURES.length ? String(next) : undefined,
    };
  }
}
