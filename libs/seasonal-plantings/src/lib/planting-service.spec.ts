import { describe, expect, it, vi } from 'vitest';
import { PlantingService, type SowingPlanner } from './planting-service';
import type { GardenRole, PlantingCreateDto } from '@open-garden/shared-types';

const tomato = {
  id: 'plant-tomato',
  commonName: 'Cherry Tomato',
  species: 'Solanum lycopersicum',
  cultivar: 'Cherry',
  plantType: 'vegetable',
  status: 'active',
};

const maple = {
  id: 'plant-maple',
  commonName: 'Red Maple',
  species: 'Acer rubrum',
  cultivar: null,
  plantType: 'tree',
  status: 'deprecated',
};

describe('PlantingService', () => {
  it('requires indoor start date for transplants and forbids it for direct seed', async () => {
    const mem = createMemory();
    await expect(
      mem.service.create(mem.ownerId, mem.gardenId, {
        plantId: tomato.id,
        startMethod: 'transplant',
      }),
    ).rejects.toMatchObject({ message: 'Indoor start date is required for transplants' });
    await expect(
      mem.service.create(mem.ownerId, mem.gardenId, {
        plantId: tomato.id,
        startMethod: 'direct_seed',
        indoorStartedOn: '2026-08-01',
      }),
    ).rejects.toMatchObject({
      message: 'Direct seed plantings cannot have an indoor start date',
    });
  });
  it('adds the same variety twice as two rows and lists newest recorded first', async () => {
    const mem = createMemory();
    const first = await mem.service.create(mem.ownerId, mem.gardenId, { plantId: tomato.id });
    await new Promise((r) => setTimeout(r, 5));
    const second = await mem.service.create(mem.ownerId, mem.gardenId, { plantId: tomato.id });
    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(second.list.plantings).toHaveLength(2);
    expect(second.list.plantings[0]?.createdAt >= second.list.plantings[1]!.createdAt).toBe(true);
  });

  it('retries the same client id in this garden without a second row and conflicts in another garden', async () => {
    const mem = createMemory();
    const id = '11111111-1111-4111-8111-111111111111';
    const first = await mem.service.create(mem.ownerId, mem.gardenId, { id, plantId: tomato.id });
    const retry = await mem.service.create(mem.ownerId, mem.gardenId, { id, plantId: tomato.id });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.list.plantings).toHaveLength(1);
    await expect(
      mem.service.create(mem.ownerId, mem.otherGardenId, { id, plantId: tomato.id }),
    ).rejects.toMatchObject({ message: 'That id is already in use' });
  });

  it('rejects harvest before planted and keeps prior values on failed patch', async () => {
    const mem = createMemory();
    const created = await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      plantedOn: '2026-06-01',
    });
    const plantingId = created.list.plantings[0]!.id;
    await expect(
      mem.service.update(mem.ownerId, mem.gardenId, plantingId, {
        harvestedOn: '2026-05-01',
      }),
    ).rejects.toMatchObject({ message: 'Harvest date must be on or after planted date' });
    const list = await mem.service.list(mem.ownerId, mem.gardenId);
    expect(list.plantings[0]?.plantedOn).toBe('2026-06-01');
    expect(list.plantings[0]?.harvestedOn).toBeNull();
  });

  it('last-write-wins on sequential date patches', async () => {
    const mem = createMemory();
    const created = await mem.service.create(mem.ownerId, mem.gardenId, { plantId: tomato.id });
    const plantingId = created.list.plantings[0]!.id;
    await mem.service.update(mem.ownerId, mem.gardenId, plantingId, { plantedOn: '2026-05-01' });
    const later = await mem.service.update(mem.ownerId, mem.gardenId, plantingId, {
      plantedOn: '2026-07-01',
    });
    expect(later.plantedOn).toBe('2026-07-01');
  });

  it('delete of a missing planting is not found, not idempotent success', async () => {
    const mem = createMemory();
    await expect(
      mem.service.remove(mem.ownerId, mem.gardenId, '22222222-2222-4222-8222-222222222222'),
    ).rejects.toMatchObject({ message: 'Planting not found' });
  });

  it('refuses viewers, unknown plants, and non-members; lists deprecated varieties', async () => {
    const mem = createMemory();
    await expect(
      mem.service.create(mem.viewerId, mem.gardenId, { plantId: tomato.id }),
    ).rejects.toMatchObject({ message: 'Viewers cannot update plantings' });
    await expect(
      mem.service.create(mem.ownerId, mem.gardenId, { plantId: 'missing' }),
    ).rejects.toMatchObject({ message: 'Plant not found' });
    await expect(mem.service.list(mem.strangerId, mem.gardenId)).rejects.toMatchObject({
      message: 'Garden not found',
    });
    const listed = await mem.service.create(mem.ownerId, mem.gardenId, { plantId: maple.id });
    expect(listed.list.plantings[0]?.status).toBe('deprecated');
  });

  it('creates unique bed names, unassigns plantings on delete, and refuses viewer bed mutate', async () => {
    const mem = createMemory();
    const bed = await mem.service.createBed(mem.ownerId, mem.gardenId, {
      name: '  Raised bed 1  ',
      lengthInches: 96,
      widthInches: 48,
    });
    expect(bed.bed.name).toBe('Raised bed 1');
    await expect(
      mem.service.createBed(mem.ownerId, mem.gardenId, {
        name: 'raised bed 1',
        lengthInches: 96,
        widthInches: 48,
      }),
    ).rejects.toMatchObject({ message: 'That garden already has a bed with that name' });
    await expect(
      mem.service.createBed(mem.ownerId, mem.gardenId, {
        name: '   ',
        lengthInches: 96,
        widthInches: 48,
      }),
    ).rejects.toMatchObject({
      message: 'Bed name is required',
    });
    const created = await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      bedId: bed.bed.id,
    });
    expect(created.list.plantings[0]?.bedId).toBe(bed.bed.id);
    await mem.service.deleteBed(mem.ownerId, mem.gardenId, bed.bed.id);
    const after = await mem.service.list(mem.ownerId, mem.gardenId);
    expect(after.beds).toHaveLength(0);
    expect(after.plantings).toHaveLength(0);
    await expect(
      mem.service.createBed(mem.viewerId, mem.gardenId, {
        name: 'Nope',
        lengthInches: 96,
        widthInches: 48,
      }),
    ).rejects.toMatchObject({ message: 'Viewers cannot update beds' });
  });

  it('deletes in-bed direct seed and returns transplants to the tray on bed delete', async () => {
    const mem = createMemory();
    const bed = await mem.service.createBed(mem.ownerId, mem.gardenId, {
      name: 'East',
      lengthInches: 96,
      widthInches: 48,
    });
    await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      bedId: bed.bed.id,
      startMethod: 'direct_seed',
    });
    await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      bedId: bed.bed.id,
      startMethod: 'transplant',
      indoorStartedOn: '2026-08-01',
    });
    await mem.service.deleteBed(mem.ownerId, mem.gardenId, bed.bed.id);
    const after = await mem.service.list(mem.ownerId, mem.gardenId);
    expect(after.plantings).toHaveLength(1);
    expect(after.plantings[0]?.startMethod).toBe('transplant');
    expect(after.plantings[0]?.bedId).toBeNull();
    expect(after.plantings[0]?.indoorStartedOn).toBe('2026-08-01');
  });

  it('retries bed client ids, renames, and rejects unknown beds', async () => {
    const mem = createMemory();
    const id = '33333333-3333-4333-8333-333333333333';
    const first = await mem.service.createBed(mem.ownerId, mem.gardenId, {
      id,
      name: 'East',
      lengthInches: 96,
      widthInches: 48,
    });
    const retry = await mem.service.createBed(mem.ownerId, mem.gardenId, {
      id,
      name: 'East',
      lengthInches: 96,
      widthInches: 48,
    });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    await expect(
      mem.service.createBed(mem.ownerId, mem.otherGardenId, {
        id,
        name: 'West',
        lengthInches: 96,
        widthInches: 48,
      }),
    ).rejects.toMatchObject({ message: 'That id is already in use' });
    const renamed = await mem.service.renameBed(mem.ownerId, mem.gardenId, first.bed.id, {
      name: 'East bed',
    });
    expect(renamed.name).toBe('East bed');
    const other = await mem.service.createBed(mem.ownerId, mem.gardenId, {
      name: 'South',
      lengthInches: 96,
      widthInches: 48,
    });
    await expect(
      mem.service.renameBed(mem.ownerId, mem.gardenId, other.bed.id, { name: 'east bed' }),
    ).rejects.toMatchObject({ message: 'That garden already has a bed with that name' });
    await expect(
      mem.service.renameBed(mem.ownerId, mem.gardenId, 'missing-bed', { name: 'Nope' }),
    ).rejects.toMatchObject({ message: 'Bed not found' });
    await expect(
      mem.service.create(mem.ownerId, mem.gardenId, { plantId: tomato.id, bedId: 'missing-bed' }),
    ).rejects.toMatchObject({ message: 'Bed not found' });
    const planting = await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      bedId: first.bed.id,
    });
    const unassigned = await mem.service.update(
      mem.ownerId,
      mem.gardenId,
      planting.list.plantings[0]!.id,
      {
        bedId: null,
      },
    );
    expect(unassigned.bedId).toBeNull();
    await expect(
      mem.service.deleteBed(mem.ownerId, mem.gardenId, 'missing-bed'),
    ).rejects.toMatchObject({ message: 'Bed not found' });
  });
});

function createMemory(sowing?: SowingPlanner) {
  const ownerId = 'owner-1';
  const viewerId = 'viewer-1';
  const strangerId = 'stranger-1';
  const gardenId = 'garden-1';
  const otherGardenId = 'garden-2';
  const plants = new Map([
    [tomato.id, tomato],
    [maple.id, maple],
  ]);
  const memberships = new Map<string, { gardenId: string; userId: string; role: GardenRole }>([
    [`${gardenId}:${ownerId}`, { gardenId, userId: ownerId, role: 'owner' }],
    [`${gardenId}:${viewerId}`, { gardenId, userId: viewerId, role: 'viewer' }],
    [`${otherGardenId}:${ownerId}`, { gardenId: otherGardenId, userId: ownerId, role: 'owner' }],
  ]);
  type PlantingRow = {
    id: string;
    gardenId: string;
    plantId: string;
    bedId: string | null;
    plantedOn: string | null;
    harvestedOn: string | null;
    startMethod: string;
    indoorStartedOn: string | null;
    life: string;
    seasonYear: number;
    createdAt: Date;
    updatedAt: Date;
  };
  type BedRow = {
    id: string;
    gardenId: string;
    name: string;
    nameNormalized: string;
    createdAt: Date;
    updatedAt: Date;
  };
  const plantingRows = new Map<string, PlantingRow>();
  const harvests = new Map<
    string,
    { plantingId: string; harvestedOn: string; grams: number | null; count: number | null }
  >();
  const bedRows = new Map<string, BedRow>();
  let seq = 0;

  function withPlant(row: PlantingRow) {
    const plant = plants.get(row.plantId)!;
    return { ...plant, ...row };
  }

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
  const plantingRepo = {
    async listByGarden(gId: string, page: number, pageSize: number) {
      const items = [...plantingRows.values()]
        .filter((r) => r.gardenId === gId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
        .map(withPlant);
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        totalCount: items.length,
        page,
        pageSize,
      };
    },
    async getById(id: string) {
      return plantingRows.get(id) ?? null;
    },
    async getInGarden(gId: string, id: string) {
      const row = plantingRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      return withPlant(row);
    },
    async insert(input: {
      id?: string;
      gardenId: string;
      plantId: string;
      bedId: string | null;
      plantedOn: string | null;
      harvestedOn: string | null;
      startMethod?: string;
      indoorStartedOn?: string | null;
      life?: string;
      seasonYear?: number;
    }) {
      const now = new Date();
      const row: PlantingRow = {
        id: input.id ?? `planting-${++seq}`,
        gardenId: input.gardenId,
        plantId: input.plantId,
        bedId: input.bedId,
        plantedOn: input.plantedOn,
        harvestedOn: input.harvestedOn,
        startMethod: input.startMethod ?? 'direct_seed',
        indoorStartedOn: input.indoorStartedOn ?? null,
        life: input.life ?? 'annual',
        seasonYear: input.seasonYear ?? 2026,
        createdAt: now,
        updatedAt: now,
      };
      plantingRows.set(row.id, row);
      return row;
    },
    async update(
      gId: string,
      id: string,
      patch: { plantedOn?: string | null; harvestedOn?: string | null; bedId?: string | null },
    ) {
      const row = plantingRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      if (patch.plantedOn !== undefined) row.plantedOn = patch.plantedOn;
      if (patch.harvestedOn !== undefined) row.harvestedOn = patch.harvestedOn;
      if (patch.bedId !== undefined) row.bedId = patch.bedId;
      row.updatedAt = new Date();
      return row;
    },
    async clearLayoutCoords() {
      return null;
    },
    async logHarvest(
      plantingId: string,
      harvestedOn: string,
      grams: number | null,
      count: number | null,
    ) {
      const key = `${plantingId}:${harvestedOn}`;
      const old = harvests.get(key);
      const add = (a: number | null | undefined, b: number | null) =>
        b === null ? (a ?? null) : (a ?? 0) + b;
      harvests.set(key, {
        plantingId,
        harvestedOn,
        grams: add(old?.grams, grams),
        count: add(old?.count, count),
      });
    },
    async listHarvests(gId: string) {
      return [...harvests.values()]
        .filter((h) => plantingRows.get(h.plantingId)?.gardenId === gId)
        .sort((a, b) => a.harvestedOn.localeCompare(b.harvestedOn));
    },
    async deleteHarvest(plantingId: string, harvestedOn: string) {
      harvests.delete(`${plantingId}:${harvestedOn}`);
    },
    async listHarvestsForSeason(gId: string, year: number) {
      return [...harvests.values()]
        .map((h) => ({ h, row: plantingRows.get(h.plantingId)! }))
        .filter(({ row }) => row.gardenId === gId && row.seasonYear === year)
        .map(({ h, row }) => {
          const plant = plants.get(row.plantId)!;
          return {
            ...h,
            plantId: plant.id,
            cropId: (plant as { cropId?: string | null }).cropId ?? null,
            commonName: plant.commonName,
            cultivar: plant.cultivar ?? null,
          };
        })
        .sort(
          (a, b) =>
            a.commonName.localeCompare(b.commonName) || a.harvestedOn.localeCompare(b.harvestedOn),
        );
    },
    async harvestSeasons(gId: string) {
      const years = new Set(
        [...harvests.values()]
          .map((h) => plantingRows.get(h.plantingId)!)
          .filter((row) => row.gardenId === gId)
          .map((row) => row.seasonYear),
      );
      return [...years].sort((a, b) => b - a);
    },
    async delete(gId: string, id: string) {
      const row = plantingRows.get(id);
      if (!row || row.gardenId !== gId) return false;
      plantingRows.delete(id);
      return true;
    },
    async deleteDirectSeedInBed(gId: string, bedId: string) {
      for (const [id, planting] of [...plantingRows.entries()]) {
        if (
          planting.gardenId === gId &&
          planting.bedId === bedId &&
          planting.startMethod === 'direct_seed'
        ) {
          plantingRows.delete(id);
        }
      }
    },
    async unassignTransplantsInBed(gId: string, bedId: string) {
      for (const planting of plantingRows.values()) {
        if (
          planting.gardenId === gId &&
          planting.bedId === bedId &&
          planting.startMethod === 'transplant'
        ) {
          planting.bedId = null;
        }
      }
    },
    async listUnplacedTransplants(gId: string) {
      return [...plantingRows.values()]
        .filter((r) => r.gardenId === gId && r.startMethod === 'transplant' && r.bedId === null)
        .map((r) => ({
          ...withPlant(r),
          spacingInches: null,
          layoutXInches: null,
          layoutYInches: null,
        }));
    },
  };
  const bedRepo = {
    async listByGarden(gId: string) {
      return [...bedRows.values()]
        .filter((b) => b.gardenId === gId)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async getById(id: string) {
      return bedRows.get(id) ?? null;
    },
    async getInGarden(gId: string, id: string) {
      const row = bedRows.get(id);
      return row && row.gardenId === gId ? row : null;
    },
    async findByNormalizedName(gId: string, nameNormalized: string) {
      return (
        [...bedRows.values()].find(
          (b) => b.gardenId === gId && b.nameNormalized === nameNormalized,
        ) ?? null
      );
    },
    async insert(input: {
      id?: string;
      gardenId: string;
      name: string;
      nameNormalized: string;
      originXInches?: number;
      originYInches?: number;
      lengthInches?: number;
      widthInches?: number;
    }) {
      const now = new Date();
      const row: BedRow = {
        id: input.id ?? `bed-${++seq}`,
        gardenId: input.gardenId,
        name: input.name,
        nameNormalized: input.nameNormalized,
        createdAt: now,
        updatedAt: now,
      };
      bedRows.set(row.id, row);
      return row;
    },
    async rename(gId: string, id: string, name: string, nameNormalized: string) {
      const row = bedRows.get(id);
      if (!row || row.gardenId !== gId) return null;
      row.name = name;
      row.nameNormalized = nameNormalized;
      row.updatedAt = new Date();
      return row;
    },
    async delete(gId: string, id: string) {
      const row = bedRows.get(id);
      if (!row || row.gardenId !== gId) return false;
      bedRows.delete(id);
      return true;
    },
  };

  const service = new PlantingService(
    membershipRepo as never,
    plantRepo as never,
    plantingRepo as never,
    bedRepo as never,
    undefined,
    undefined,
    sowing,
  );
  return { service, ownerId, viewerId, strangerId, gardenId, otherGardenId };
}

describe('PlantingService area check after a catalog update', () => {
  // Saved in a vegetable bed as a fruit; the catalog now calls it a tree.
  const apple = {
    id: 'planting-apple',
    gardenId: 'g',
    plantId: 'plant-apple',
    commonName: 'Apple',
    species: 'Malus domestica',
    cultivar: null,
    plantType: 'tree',
    status: 'active',
    plantedOn: null,
    harvestedOn: null,
    bedId: 'veg',
    trayId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const beds = {
    veg: { id: 'veg', station: null, areaId: null },
    veg2: { id: 'veg2', station: null, areaId: null },
  };
  const service = new PlantingService(
    { get: async () => ({ role: 'owner' }) } as never,
    {} as never,
    {
      getInGarden: async () => apple,
      update: async () => apple,
      clearLayoutCoords: async () => undefined,
      occupants: async () => [],
    } as never,
    { getInGarden: async (_g: string, id: 'veg' | 'veg2') => beds[id] ?? null } as never,
    { getById: async () => null } as never,
  );

  it('saves edits to a planting its bed would no longer accept', async () => {
    await expect(
      service.update('u', 'g', apple.id, { bedId: 'veg', note: 'pruned' }),
    ).resolves.toMatchObject({ id: apple.id });
  });

  it('still refuses moving it to another bed that does not accept it', async () => {
    await expect(service.update('u', 'g', apple.id, { bedId: 'veg2' })).rejects.toMatchObject({
      message: 'A tree belongs in an orchard',
    });
  });
});

describe('PlantingService area rules', () => {
  const planting = (plantType: string) => ({
    id: `p-${plantType}`,
    gardenId: 'g',
    plantId: `plant-${plantType}`,
    commonName: plantType,
    species: 'x',
    cultivar: null,
    plantType,
    status: 'active',
    plantedOn: null,
    harvestedOn: null,
    bedId: null,
    trayId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const rows = { cane: planting('cane'), tree: planting('tree') };
  const beds: Record<string, { id: string; station: string | null; areaId: string | null }> = {
    canes: { id: 'canes', station: null, areaId: 'bramble-area' },
  };
  const inserted: Record<string, unknown>[] = [];
  const service = new PlantingService(
    { get: async () => ({ role: 'owner' }) } as never,
    {} as never,
    {
      getInGarden: async (_g: string, id: string) =>
        Object.values(rows).find((row) => row.id === id) ?? null,
      update: async (_g: string, id: string) =>
        Object.values(rows).find((row) => row.id === id) ?? null,
      clearLayoutCoords: async () => undefined,
      occupants: async () => [],
    } as never,
    {
      getInGarden: async (_g: string, id: string) => beds[id] ?? null,
      findByNormalizedName: async () => null,
      getById: async () => null,
      insert: async (input: Record<string, unknown>) => {
        inserted.push(input);
        return { ...input, id: 'new', createdAt: new Date(), updatedAt: new Date() };
      },
    } as never,
    {
      getById: async (id: string) => (id === 'bramble-area' ? { kind: 'bramble' } : null),
      getInGarden: async (_g: string, id: string) =>
        id === 'bramble-area' ? { id, kind: 'bramble' } : null,
      ensure: async (_g: string, kind: string) => ({ id: `${kind}-area`, kind }),
    } as never,
  );

  it('takes cane fruit in a bramble patch and refuses a tree there', async () => {
    await expect(service.update('u', 'g', rows.cane.id, { bedId: 'canes' })).resolves.toMatchObject(
      { id: rows.cane.id },
    );
    await expect(service.update('u', 'g', rows.tree.id, { bedId: 'canes' })).rejects.toMatchObject({
      message: 'A tree belongs in an orchard',
    });
  });

  it('gives a bed the station of the area it is created in', async () => {
    const size = { lengthInches: 48, widthInches: 48 };
    await service.createBed('u', 'g', { name: 'Canes', areaId: 'bramble-area', ...size });
    await service.createBed('u', 'g', { name: 'Raspberries', station: 'berry', ...size });
    expect(inserted.map((row) => [row['areaId'], row['station']])).toEqual([
      ['bramble-area', 'berry'],
      ['bramble-area', 'berry'],
    ]);
  });
});

describe('PlantingService areas: rename, delete, move a bed', () => {
  type Area = { id: string; name: string; kind: string };
  function setup() {
    const areas = new Map<string, Area>([
      ['veg', { id: 'veg', name: 'Vegetable garden', kind: 'vegetable' }],
      ['veg2', { id: 'veg2', name: 'Vegetable garden 2', kind: 'vegetable' }],
      ['orchard', { id: 'orchard', name: 'Orchard', kind: 'orchard' }],
      ['canes', { id: 'canes', name: 'Bramble patch', kind: 'bramble' }],
      ['glass', { id: 'glass', name: 'Greenhouse', kind: 'greenhouse' }],
    ]);
    const bed = {
      id: 'north',
      gardenId: 'g',
      name: 'North',
      areaId: 'veg',
      station: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const occupants: { id: string; plantType: string }[] = [{ id: 'p1', plantType: 'vegetable' }];
    const roles: Record<string, string> = { owner: 'owner', viewer: 'viewer' };
    const service = new PlantingService(
      { get: async (_g: string, u: string) => (roles[u] ? { role: roles[u] } : null) } as never,
      {} as never,
      { occupants: async () => occupants } as never,
      {
        getInGarden: async (_g: string, id: string) => (id === bed.id ? bed : null),
        findByNormalizedName: async () => null,
        rename: async () => bed,
        listByGarden: async () => [bed],
        setArea: async (_g: string, _id: string, areaId: string, station: string | null) =>
          Object.assign(bed, { areaId, station }),
      } as never,
      {
        getInGarden: async (gardenId: string, id: string) =>
          gardenId === 'g' ? (areas.get(id) ?? null) : null,
        findByName: async (_g: string, name: string) =>
          [...areas.values()].find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? null,
        rename: async (_g: string, id: string, name: string) => {
          const area = areas.get(id);
          return area ? Object.assign(area, { name }) : null;
        },
        delete: async (_g: string, id: string) => areas.delete(id),
      } as never,
      { listByGarden: async () => [{ id: 't1', areaId: 'glass', name: 'Tray' }] } as never,
    );
    return { service, areas, bed, occupants };
  }

  it('renames an area, refusing a blank name, a name in use, and viewers', async () => {
    const { service } = setup();
    await expect(service.renameArea('owner', 'g', 'veg', '  Kitchen garden ')).resolves.toEqual({
      id: 'veg',
      name: 'Kitchen garden',
      kind: 'vegetable',
    });
    await expect(service.renameArea('owner', 'g', 'veg', 'kitchen GARDEN')).resolves.toBeTruthy();
    await expect(service.renameArea('owner', 'g', 'veg', 'orchard')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(service.renameArea('owner', 'g', 'veg', ' ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(service.renameArea('owner', 'g', 'gone', 'X')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.renameArea('viewer', 'g', 'veg', 'X')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('deletes only an empty area', async () => {
    const { service, areas } = setup();
    await expect(service.deleteArea('owner', 'g', 'veg')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Vegetable garden still holds 1 bed: move or delete them first',
    });
    await expect(service.deleteArea('owner', 'g', 'glass')).rejects.toMatchObject({
      message: 'Greenhouse still holds trays: move or delete its trays first',
    });
    await service.deleteArea('owner', 'g', 'veg2');
    expect(areas.has('veg2')).toBe(false);
    await expect(service.deleteArea('owner', 'g', 'veg2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.deleteArea('viewer', 'g', 'orchard')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('moves a bed to an area that takes its plants, and its station follows', async () => {
    const { service, bed, occupants } = setup();
    await expect(
      service.renameBed('owner', 'g', 'north', { name: 'North', areaId: 'veg2' }),
    ).resolves.toMatchObject({ areaId: 'veg2', station: null });
    await expect(
      service.renameBed('owner', 'g', 'north', { name: 'North', areaId: 'canes' }),
    ).rejects.toMatchObject({
      message: 'Bramble patch will not take this bed: This plant belongs in a vegetable garden',
    });
    await expect(
      service.renameBed('owner', 'g', 'north', { name: 'North', areaId: 'glass' }),
    ).rejects.toMatchObject({ message: 'A greenhouse holds trays, not beds' });
    await expect(
      service.renameBed('owner', 'g', 'north', { name: 'North', areaId: 'missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // An orchard takes herbaceous underplanting but one tree per bed.
    occupants.splice(0, 1, { id: 't1', plantType: 'tree' }, { id: 't2', plantType: 'tree' });
    await expect(
      service.renameBed('owner', 'g', 'north', { name: 'North', areaId: 'orchard' }),
    ).rejects.toMatchObject({
      message: 'Orchard will not take this bed: A tree bed holds one tree',
    });
    occupants.splice(1, 1);
    await expect(
      service.renameBed('owner', 'g', 'north', { name: 'North', areaId: 'orchard' }),
    ).resolves.toMatchObject({ areaId: 'orchard', station: 'tree' });
    expect(bed.station).toBe('tree');
  });
});

describe('PlantingService.repeat (succession planting)', () => {
  async function sown(
    mem: ReturnType<typeof createMemory>,
    plantedOn: string | null,
    extra: Partial<PlantingCreateDto> = {},
  ) {
    const { list } = await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      plantedOn,
      ...extra,
    });
    return list.plantings[0]!.id;
  }

  it('adds a sowing every N weeks up to the date, without a bed', async () => {
    const mem = createMemory();
    const id = await sown(mem, '2026-04-01');
    const { list, added } = await mem.service.repeat(
      mem.ownerId,
      mem.gardenId,
      id,
      2,
      '2026-05-14',
    );
    expect(added).toBe(3);
    const copies = list.plantings.filter((p) => p.id !== id);
    expect(copies.map((p) => p.plantedOn).sort()).toEqual([
      '2026-04-15',
      '2026-04-29',
      '2026-05-13',
    ]);
    expect(copies.every((p) => p.bedId === null && p.plantId === tomato.id)).toBe(true);
  });

  it('moves a transplant’s indoor start with its sow date', async () => {
    const mem = createMemory();
    const id = await sown(mem, '2026-05-01', {
      startMethod: 'transplant',
      indoorStartedOn: '2026-03-20',
    });
    const { list } = await mem.service.repeat(mem.ownerId, mem.gardenId, id, 3, '2026-05-22');
    const copy = list.plantings.find((p) => p.id !== id)!;
    expect(copy).toMatchObject({
      startMethod: 'transplant',
      plantedOn: '2026-05-22',
      indoorStartedOn: '2026-04-10',
    });
  });

  it('refuses without a sow date, when nothing fits, past 26 sowings, and for viewers', async () => {
    const mem = createMemory();
    const undated = await sown(mem, null);
    await expect(
      mem.service.repeat(mem.ownerId, mem.gardenId, undated, 2, '2026-06-01'),
    ).rejects.toMatchObject({ message: 'Give the planting a sow date before repeating it' });
    const id = await sown(mem, '2026-04-01');
    await expect(
      mem.service.repeat(mem.ownerId, mem.gardenId, id, 2, '2026-04-10'),
    ).rejects.toMatchObject({
      message: expect.stringContaining('No sowing fits before that date'),
    });
    await expect(
      mem.service.repeat(mem.ownerId, mem.gardenId, id, 1, '2026-12-31'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('26') });
    await expect(
      mem.service.repeat(mem.viewerId, mem.gardenId, id, 2, '2026-06-01'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('repeats only annual plantings', async () => {
    const mem = createMemory();
    const id = await sown(mem, '2026-04-01', { life: 'perennial' });
    await expect(
      mem.service.repeat(mem.ownerId, mem.gardenId, id, 2, '2026-06-01'),
    ).rejects.toMatchObject({ message: 'Only annual plantings repeat' });
  });

  it('leaves out dates outside the sowing windows and after the last useful sowing', async () => {
    const plan = vi.fn(async () => ({
      windows: [
        { from: '2026-04-01', to: '2026-05-31' },
        { from: '2026-08-01', to: '2026-09-15' },
      ],
      lastSowOn: '2026-09-01',
    }));
    const mem = createMemory({ plan });
    const id = await sown(mem, '2026-04-01');
    const result = await mem.service.repeat(mem.ownerId, mem.gardenId, id, 4, '2026-10-01');
    // Every 4 weeks: Apr 29, May 27 in spring; Jun 24, Jul 22 in the summer
    // gap; Aug 19 in fall; Sep 16 after the last useful sowing.
    expect(
      result.list.plantings
        .filter((p) => p.id !== id)
        .map((p) => p.plantedOn)
        .sort(),
    ).toEqual(['2026-04-29', '2026-05-27', '2026-08-19']);
    expect(result).toMatchObject({ added: 3, outOfWindow: 2, tooLate: 1, lastSowOn: '2026-09-01' });
    expect(plan).toHaveBeenCalledWith(mem.gardenId, tomato.id, 'direct_seed', '2026-04-01');
    expect(await mem.service.repeatPlan(mem.ownerId, mem.gardenId, id)).toEqual({
      lastSowOn: '2026-09-01',
    });
  });

  it('names the last useful sowing when nothing fits', async () => {
    const mem = createMemory({
      plan: async () => ({
        windows: [{ from: '2026-04-01', to: '2026-04-20' }],
        lastSowOn: '2026-08-01',
      }),
    });
    const id = await sown(mem, '2026-04-01');
    await expect(
      mem.service.repeat(mem.ownerId, mem.gardenId, id, 4, '2026-06-30'),
    ).rejects.toMatchObject({ message: expect.stringContaining('2026-08-01') });
  });
});

describe('PlantingService harvests (ADR 0038)', () => {
  async function planted(mem: ReturnType<typeof createMemory>, plantedOn = '2026-05-01') {
    const { list } = await mem.service.create(mem.ownerId, mem.gardenId, {
      plantId: tomato.id,
      plantedOn,
    });
    return list.plantings[0]!.id;
  }

  it('logs harvests with a weight or a count and returns them on the planting', async () => {
    const mem = createMemory();
    const id = await planted(mem);
    await mem.service.logHarvest(mem.ownerId, mem.gardenId, id, {
      harvestedOn: '2026-07-01',
      grams: 900,
    });
    const p = await mem.service.logHarvest(mem.ownerId, mem.gardenId, id, {
      harvestedOn: '2026-07-08',
      count: 6,
    });
    expect(p.harvests).toEqual([
      { harvestedOn: '2026-07-01', grams: 900, count: null },
      { harvestedOn: '2026-07-08', grams: null, count: 6 },
    ]);
  });

  it('refuses a harvest before sowing, from a viewer, or on a missing planting', async () => {
    const mem = createMemory();
    const id = await planted(mem);
    await expect(
      mem.service.logHarvest(mem.ownerId, mem.gardenId, id, { harvestedOn: '2026-04-01' }),
    ).rejects.toMatchObject({ message: 'Harvest date must be on or after planted date' });
    await expect(
      mem.service.logHarvest(mem.viewerId, mem.gardenId, id, { harvestedOn: '2026-07-01' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      mem.service.logHarvest(mem.ownerId, mem.gardenId, 'missing', { harvestedOn: '2026-07-01' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deleting the day a planting was marked harvested clears that mark', async () => {
    const mem = createMemory();
    const id = await planted(mem);
    await mem.service.update(mem.ownerId, mem.gardenId, id, { harvestedOn: '2026-08-01' });
    await mem.service.logHarvest(mem.ownerId, mem.gardenId, id, {
      harvestedOn: '2026-08-01',
      grams: 300,
    });
    const p = await mem.service.deleteHarvest(mem.ownerId, mem.gardenId, id, '2026-08-01');
    expect(p.harvestedOn).toBeNull();
    expect(p.harvests).toEqual([]);
  });

  it('totals a season by crop for any member, the latest season by default', async () => {
    const mem = createMemory();
    const first = await planted(mem);
    const second = await planted(mem, '2026-06-01');
    await mem.service.logHarvest(mem.ownerId, mem.gardenId, first, {
      harvestedOn: '2026-07-01',
      grams: 900,
      count: 2,
    });
    await mem.service.logHarvest(mem.ownerId, mem.gardenId, second, {
      harvestedOn: '2026-08-01',
      grams: 600,
    });
    const totals = await mem.service.harvestTotals(mem.viewerId, mem.gardenId);
    expect(totals).toMatchObject({ seasonYear: 2026, seasons: [2026] });
    expect(totals.crops).toEqual([
      expect.objectContaining({ name: tomato.commonName, grams: 1500, count: 2 }),
    ]);
    expect(totals.crops[0]!.harvests.map((h) => h.harvestedOn)).toEqual([
      '2026-07-01',
      '2026-08-01',
    ]);
    expect((await mem.service.harvestTotals(mem.ownerId, mem.gardenId, 2025)).crops).toEqual([]);
    await expect(mem.service.harvestTotals(mem.strangerId, mem.gardenId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
