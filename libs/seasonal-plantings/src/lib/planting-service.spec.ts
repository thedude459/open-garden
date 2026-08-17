import { describe, expect, it } from 'vitest';
import { PlantingService } from './planting-service';
import type { GardenRole } from '@open-garden/shared-types';

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
    const bed = await mem.service.createBed(mem.ownerId, mem.gardenId, { name: '  Raised bed 1  ' });
    expect(bed.bed.name).toBe('Raised bed 1');
    await expect(
      mem.service.createBed(mem.ownerId, mem.gardenId, { name: 'raised bed 1' }),
    ).rejects.toMatchObject({ message: 'That garden already has a bed with that name' });
    await expect(mem.service.createBed(mem.ownerId, mem.gardenId, { name: '   ' })).rejects.toMatchObject({
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
    expect(after.plantings[0]?.bedId).toBeNull();
    await expect(
      mem.service.createBed(mem.viewerId, mem.gardenId, { name: 'Nope' }),
    ).rejects.toMatchObject({ message: 'Viewers cannot update beds' });
  });

  it('retries bed client ids, renames, and rejects unknown beds', async () => {
    const mem = createMemory();
    const id = '33333333-3333-4333-8333-333333333333';
    const first = await mem.service.createBed(mem.ownerId, mem.gardenId, { id, name: 'East' });
    const retry = await mem.service.createBed(mem.ownerId, mem.gardenId, { id, name: 'East' });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    await expect(
      mem.service.createBed(mem.ownerId, mem.otherGardenId, { id, name: 'West' }),
    ).rejects.toMatchObject({ message: 'That id is already in use' });
    const renamed = await mem.service.renameBed(mem.ownerId, mem.gardenId, first.bed.id, {
      name: 'East bed',
    });
    expect(renamed.name).toBe('East bed');
    const other = await mem.service.createBed(mem.ownerId, mem.gardenId, { name: 'South' });
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
    const unassigned = await mem.service.update(mem.ownerId, mem.gardenId, planting.list.plantings[0]!.id, {
      bedId: null,
    });
    expect(unassigned.bedId).toBeNull();
    await expect(
      mem.service.deleteBed(mem.ownerId, mem.gardenId, 'missing-bed'),
    ).rejects.toMatchObject({ message: 'Bed not found' });
  });
});

function createMemory() {
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
      return { items: items.slice(start, start + pageSize), totalCount: items.length, page, pageSize };
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
    }) {
      const now = new Date();
      const row: PlantingRow = {
        id: input.id ?? `planting-${++seq}`,
        gardenId: input.gardenId,
        plantId: input.plantId,
        bedId: input.bedId,
        plantedOn: input.plantedOn,
        harvestedOn: input.harvestedOn,
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
    async delete(gId: string, id: string) {
      const row = plantingRows.get(id);
      if (!row || row.gardenId !== gId) return false;
      plantingRows.delete(id);
      return true;
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
        [...bedRows.values()].find((b) => b.gardenId === gId && b.nameNormalized === nameNormalized) ??
        null
      );
    },
    async insert(input: { id?: string; gardenId: string; name: string; nameNormalized: string }) {
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
      for (const planting of plantingRows.values()) {
        if (planting.bedId === id) planting.bedId = null;
      }
      return true;
    },
  };

  const service = new PlantingService(
    membershipRepo as never,
    plantRepo as never,
    plantingRepo as never,
    bedRepo as never,
  );
  return { service, ownerId, viewerId, strangerId, gardenId, otherGardenId };
}
