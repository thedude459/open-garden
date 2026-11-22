import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarService } from './calendar-service';
import type { FrostAnchor, GardenRole, PlantStatus, PlantType } from '@open-garden/shared-types';

const plantDefaults = {
  species: 'Species',
  cultivar: null as string | null,
  plantType: 'vegetable' as PlantType,
  zoneMin: 1,
  zoneMax: 13,
  daysToMaturity: null as number | null,
  status: 'active' as PlantStatus,
  indoorFrostAnchor: null as FrostAnchor | null,
  indoorWeeksEarliest: null as number | null,
  indoorWeeksLatest: null as number | null,
  sowFrostAnchor: null as FrostAnchor | null,
  sowWeeksEarliest: null as number | null,
  sowWeeksLatest: null as number | null,
  transplantFrostAnchor: null as FrostAnchor | null,
  transplantWeeksEarliest: null as number | null,
  transplantWeeksLatest: null as number | null,
  growMinC: null as number | null,
  growMaxC: null as number | null,
  sowSoilMinC: null as number | null,
};

const tomato = plantRow({
  id: 'plant-tomato',
  commonName: 'Cherry Tomato',
  plantType: 'vegetable',
  zoneMin: 4,
  zoneMax: 10,
  daysToMaturity: 65,
  indoorFrostAnchor: 'last',
  indoorWeeksEarliest: -8,
  indoorWeeksLatest: -6,
  transplantFrostAnchor: 'last',
  transplantWeeksEarliest: 1,
  transplantWeeksLatest: 2,
  growMinC: 10,
  growMaxC: 35,
  sowSoilMinC: 16,
});

const papaya = plantRow({
  id: 'plant-papaya',
  commonName: 'Papaya',
  plantType: 'fruit',
  zoneMin: 9,
  zoneMax: 11,
});

const maple = plantRow({
  id: 'plant-maple',
  commonName: 'Red Maple',
  plantType: 'tree',
  zoneMin: 3,
  zoneMax: 9,
  status: 'deprecated',
});

describe('CalendarService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('places windows by monthly temperature where it rarely frosts', async () => {
    const mem = createMemory(false, true);
    const { calendar } = await mem.service.add(mem.ownerId, mem.gardenId, tomato.id);
    expect(calendar.windowsAvailable).toBe(true);
    expect(calendar.entries[0]?.windows.transplant).toEqual({
      earliest: { month: 1, day: 1 },
      latest: { month: 12, day: 31 },
      wrapsYear: false,
    });
  });

  it('adds a plant once and lists it with computed windows', async () => {
    // Windows are counted in the season's real year; 2024 is a leap year.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2024, 5, 1));
    const mem = createMemory();
    const first = await mem.service.add(mem.ownerId, mem.gardenId, tomato.id);
    expect(first.created).toBe(true);
    expect(first.calendar.entries).toHaveLength(1);
    expect(first.calendar.windowsAvailable).toBe(true);
    expect(first.calendar.entries[0]?.windows.indoorStart?.earliest).toEqual({
      month: 2,
      day: 19,
    });

    const second = await mem.service.add(mem.ownerId, mem.gardenId, tomato.id);
    expect(second.created).toBe(false);
    expect(second.calendar.entries).toHaveLength(1);
  });

  it('removes a plant idempotently', async () => {
    const mem = createMemory();
    await mem.service.add(mem.ownerId, mem.gardenId, tomato.id);
    await mem.service.remove(mem.ownerId, mem.gardenId, tomato.id);
    await mem.service.remove(mem.ownerId, mem.gardenId, tomato.id);
    const list = await mem.service.list(mem.ownerId, mem.gardenId);
    expect(list.entries).toHaveLength(0);
  });

  it('refuses viewer add and remove', async () => {
    const mem = createMemory();
    await expect(mem.service.add(mem.viewerId, mem.gardenId, tomato.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Viewers cannot update this calendar',
    });
    await expect(mem.service.remove(mem.viewerId, mem.gardenId, tomato.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('refuses a tree until the property has an orchard', async () => {
    const blocked = createMemory(false);
    await expect(
      blocked.service.add(blocked.ownerId, blocked.gardenId, maple.id),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Add an orchard for this plant first',
    });
    const open = createMemory(true);
    const added = await open.service.add(open.ownerId, open.gardenId, maple.id);
    expect(added.created).toBe(true);
  });

  it('returns not found for unknown plant and non-member', async () => {
    const mem = createMemory();
    await expect(mem.service.add(mem.ownerId, mem.gardenId, 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Plant not found',
    });
    await expect(mem.service.list(mem.strangerId, mem.gardenId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Garden not found',
    });
  });

  it('keeps deprecated plants listed with status', async () => {
    const mem = createMemory();
    await mem.service.add(mem.ownerId, mem.gardenId, maple.id);
    const list = await mem.service.list(mem.ownerId, mem.gardenId);
    expect(list.entries[0]?.status).toBe('deprecated');
    expect(list.entries[0]?.windows.indoorStart).toBeNull();
  });

  it('says which crops can be sown or planted in the week from a local date', async () => {
    const mem = createMemory();
    // Last frost 15 April: tomato starts indoors 19 Feb – 4 Mar, transplants 22–29 Apr.
    const february = await mem.service.sowableNow(mem.ownerId, mem.gardenId, new Date(2024, 1, 14));
    expect(february(tomato)).toBe(true);
    expect(february(papaya)).toBe(false);
    const april = await mem.service.sowableNow(mem.viewerId, mem.gardenId, new Date(2024, 3, 22));
    expect(april(tomato)).toBe(true);
    const june = await mem.service.sowableNow(mem.ownerId, mem.gardenId, new Date(2024, 5, 15));
    expect(june(tomato)).toBe(false);
  });

  it('keeps "can sow now" to members of the property', async () => {
    const mem = createMemory();
    await expect(
      mem.service.sowableNow(mem.strangerId, mem.gardenId, new Date(2024, 1, 14)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('flags zone mismatch and leaves Honeycrisp-like in-range plants unmatched', async () => {
    const mem = createMemory();
    await mem.service.add(mem.ownerId, mem.gardenId, papaya.id);
    await mem.service.add(mem.ownerId, mem.gardenId, tomato.id);
    const list = await mem.service.list(mem.ownerId, mem.gardenId);
    const papayaEntry = list.entries.find((e) => e.plantId === papaya.id);
    const tomatoEntry = list.entries.find((e) => e.plantId === tomato.id);
    expect(papayaEntry?.zoneMismatch).toBe(true);
    expect(tomatoEntry?.zoneMismatch).toBe(false);
  });
});

function plantRow(partial: Partial<typeof plantDefaults> & { id: string; commonName: string }) {
  return { ...plantDefaults, ...partial };
}

function createMemory(hasOrchard?: boolean, frostFree = false) {
  const ownerId = 'owner-1';
  const viewerId = 'viewer-1';
  const strangerId = 'stranger-1';
  const gardenId = 'garden-1';
  const plants = new Map([
    [tomato.id, tomato],
    [papaya.id, papaya],
    [maple.id, maple],
  ]);
  const memberships = new Map<string, { gardenId: string; userId: string; role: GardenRole }>([
    [`${gardenId}:${ownerId}`, { gardenId, userId: ownerId, role: 'owner' }],
    [`${gardenId}:${viewerId}`, { gardenId, userId: viewerId, role: 'viewer' }],
  ]);
  /** Planned plantings by garden, crop, and season (undefined: the current one). */
  const entries = new Map<
    string,
    { gardenId: string; plantId: string; life: string; season: number | undefined }
  >();

  const gardenRepo = {
    async getById(id: string) {
      if (id !== gardenId) return null;
      return {
        id: gardenId,
        hardinessZone: frostFree ? 12 : 7,
        lastFrostMonth: frostFree ? null : 4,
        lastFrostDay: frostFree ? null : 15,
        firstFrostMonth: frostFree ? null : 10,
        firstFrostDay: frostFree ? null : 20,
        monthlyMeanC: frostFree ? [23, 23, 23, 24, 25, 26, 27, 27, 27, 26, 25, 24] : null,
      };
    },
  };

  const membershipRepo = {
    async get(gId: string, userId: string) {
      return memberships.get(`${gId}:${userId}`) ?? null;
    },
  };

  const plantRepo = {
    async getById(id: string) {
      return plants.get(id) ?? null;
    },
  };

  const entryRepo = {
    async listByGarden(gId: string, page: number, pageSize: number, season?: number) {
      const items = [...entries.values()]
        .filter((e) => e.gardenId === gId && e.season === season)
        .map((e) => {
          const plant = plants.get(e.plantId);
          if (!plant) return null;
          return {
            plantId: plant.id,
            commonName: plant.commonName,
            species: plant.species,
            cultivar: plant.cultivar,
            plantType: plant.plantType,
            status: plant.status,
            zoneMin: plant.zoneMin,
            zoneMax: plant.zoneMax,
            daysToMaturity: plant.daysToMaturity,
            indoorFrostAnchor: plant.indoorFrostAnchor,
            indoorWeeksEarliest: plant.indoorWeeksEarliest,
            indoorWeeksLatest: plant.indoorWeeksLatest,
            sowFrostAnchor: plant.sowFrostAnchor,
            sowWeeksEarliest: plant.sowWeeksEarliest,
            sowWeeksLatest: plant.sowWeeksLatest,
            transplantFrostAnchor: plant.transplantFrostAnchor,
            transplantWeeksEarliest: plant.transplantWeeksEarliest,
            transplantWeeksLatest: plant.transplantWeeksLatest,
            growMinC: plant.growMinC,
            growMaxC: plant.growMaxC,
            sowSoilMinC: plant.sowSoilMinC,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.commonName.localeCompare(b.commonName));
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        totalCount: items.length,
        page,
        pageSize,
      };
    },
    async addPlanned(gId: string, plantId: string, life: string, season?: number) {
      const key = `${gId}:${plantId}:${season}`;
      if (entries.has(key)) return { created: false };
      entries.set(key, { gardenId: gId, plantId, life, season });
      return { created: true };
    },
    async removePlanned(gId: string, plantId: string, season?: number) {
      entries.delete(`${gId}:${plantId}:${season}`);
    },
  };

  const service = new CalendarService(
    gardenRepo as never,
    membershipRepo as never,
    plantRepo as never,
    entryRepo as never,
    hasOrchard === undefined ? undefined : ({ hasKind: async () => hasOrchard } as never),
  );
  return { service, ownerId, viewerId, strangerId, gardenId, entries };
}

describe('CalendarService seasons (ADR 0040)', () => {
  it('plans a crop in the next season apart from this one, and refuses other years', async () => {
    const mem = createMemory();
    const year = new Date().getUTCFullYear();
    const { calendar } = await mem.service.add(mem.ownerId, mem.gardenId, tomato.id, year + 1);
    expect(calendar).toMatchObject({ seasonYear: year + 1, currentSeasonYear: year });
    expect(calendar.entries).toHaveLength(1);
    expect([...mem.entries.values()]).toEqual([
      { gardenId: mem.gardenId, plantId: tomato.id, life: 'annual', season: year + 1 },
    ]);
    const now = await mem.service.list(mem.ownerId, mem.gardenId);
    expect(now.entries).toHaveLength(0);
    await expect(
      mem.service.add(mem.ownerId, mem.gardenId, tomato.id, year + 2),
    ).rejects.toMatchObject({ message: 'Plan this season or the next one' });
    await mem.service.remove(mem.ownerId, mem.gardenId, tomato.id, year + 1);
    expect(
      (await mem.service.list(mem.ownerId, mem.gardenId, 1, 100, new Date(), year + 1)).entries,
    ).toEqual([]);
  });
});

describe('CalendarService.sowingPlanFor (succession planting)', () => {
  it('plans a crop at the property for the season of its first sowing', async () => {
    const mem = createMemory();
    // Tomato goes out Apr 22–29 after an Apr 15 last frost; 65 days to
    // maturity and the 14-day fall factor back from the Oct 20 first frost.
    expect(
      await mem.service.sowingPlanFor(mem.gardenId, tomato.id, 'transplant', '2027-04-22'),
    ).toEqual({ windows: [{ from: '2027-04-22', to: '2027-04-29' }], lastSowOn: '2027-08-02' });
  });

  it('allows two weeks more for a frost-tender crop', async () => {
    const garden = {
      lastFrostMonth: 4,
      lastFrostDay: 15,
      firstFrostMonth: 10,
      firstFrostDay: 20,
      monthlyMeanC: null,
    };
    const tender = { ...tomato, frostTolerance: 'tender' };
    const service = new CalendarService(
      { getById: async () => garden } as never,
      {} as never,
      { getById: async () => tender } as never,
      {} as never,
    );
    expect(
      (await service.sowingPlanFor('garden-1', tender.id, 'transplant', '2027-04-22'))?.lastSowOn,
    ).toBe('2027-07-19');
  });

  it('is null for a property or crop that is gone', async () => {
    const mem = createMemory();
    expect(
      await mem.service.sowingPlanFor('missing', tomato.id, 'transplant', '2027-04-22'),
    ).toBeNull();
    expect(
      await mem.service.sowingPlanFor(mem.gardenId, 'missing', 'transplant', '2027-04-22'),
    ).toBeNull();
  });
});
