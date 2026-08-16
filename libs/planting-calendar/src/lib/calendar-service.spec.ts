import { describe, expect, it } from 'vitest';
import { CalendarService } from './calendar-service';
import type { GardenRole } from '@open-garden/shared-types';

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
  it('adds a plant once and lists it with computed windows', async () => {
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

function plantRow(partial: Partial<ReturnType<typeof plantRow>> & { id: string; commonName: string }) {
  return {
    id: partial.id,
    commonName: partial.commonName,
    species: partial.species ?? 'Species',
    cultivar: partial.cultivar ?? null,
    plantType: partial.plantType ?? 'vegetable',
    zoneMin: partial.zoneMin ?? 1,
    zoneMax: partial.zoneMax ?? 13,
    daysToMaturity: partial.daysToMaturity ?? null,
    status: partial.status ?? 'active',
    indoorFrostAnchor: partial.indoorFrostAnchor ?? null,
    indoorWeeksEarliest: partial.indoorWeeksEarliest ?? null,
    indoorWeeksLatest: partial.indoorWeeksLatest ?? null,
    sowFrostAnchor: partial.sowFrostAnchor ?? null,
    sowWeeksEarliest: partial.sowWeeksEarliest ?? null,
    sowWeeksLatest: partial.sowWeeksLatest ?? null,
    transplantFrostAnchor: partial.transplantFrostAnchor ?? null,
    transplantWeeksEarliest: partial.transplantWeeksEarliest ?? null,
    transplantWeeksLatest: partial.transplantWeeksLatest ?? null,
  };
}

function createMemory() {
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
  const entries = new Map<string, { gardenId: string; plantId: string }>();

  const gardenRepo = {
    async getById(id: string) {
      if (id !== gardenId) return null;
      return {
        id: gardenId,
        hardinessZone: 7,
        lastFrostMonth: 4,
        lastFrostDay: 15,
        firstFrostMonth: 10,
        firstFrostDay: 20,
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
    async listByGarden(gId: string, page: number, pageSize: number) {
      const items = [...entries.values()]
        .filter((e) => e.gardenId === gId)
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
    async insert(gId: string, plantId: string) {
      const key = `${gId}:${plantId}`;
      if (entries.has(key)) return { created: false };
      entries.set(key, { gardenId: gId, plantId });
      return { created: true };
    },
    async delete(gId: string, plantId: string) {
      entries.delete(`${gId}:${plantId}`);
    },
  };

  const service = new CalendarService(
    gardenRepo as never,
    membershipRepo as never,
    plantRepo as never,
    entryRepo as never,
  );
  return { service, ownerId, viewerId, strangerId, gardenId };
}
