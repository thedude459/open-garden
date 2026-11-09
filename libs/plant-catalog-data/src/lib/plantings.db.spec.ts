// Repository integration tests against a real PostgreSQL (PGlite): plantings —
// the records whose loss would hurt most. Covers garden scoping, placement,
// bed clean-up rules, season visibility, and harvest history.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BedRepository } from './bed-repository';
import { GardenRepository } from './garden-repository';
import { PlantingAreaRepository } from './planting-area-repository';
import { PlantingRepository } from './planting-repository';
import { gardenSeasons } from './schema';
import { createTestDb, gardenInput, insertPlant, insertUser, type TestDb } from './test-db';
import { TrayRepository } from './tray-repository';

let t: TestDb;
let gardens: GardenRepository;
let beds: BedRepository;
let plantings: PlantingRepository;
let areas: PlantingAreaRepository;
let trays: TrayRepository;

beforeAll(async () => {
  t = await createTestDb();
  gardens = new GardenRepository(t.db);
  beds = new BedRepository(t.db);
  plantings = new PlantingRepository(t.db);
  areas = new PlantingAreaRepository(t.db);
  trays = new TrayRepository(t.db);
});
afterAll(() => t.close());

async function setup() {
  const owner = await insertUser(t.db);
  const garden = await gardens.createOwned(gardenInput(owner.id));
  const other = await gardens.createOwned(gardenInput(owner.id));
  const plant = await insertPlant(t.db, 'Tomato');
  const bed = await beds.insert({
    gardenId: garden.id,
    name: 'Bed',
    nameNormalized: 'bed',
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
  });
  return { garden, other, plant, bed };
}

describe('PlantingRepository', () => {
  it('inserts with defaults and records the harvest date', async () => {
    const { garden, plant, bed } = await setup();
    const p = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: bed.id,
      plantedOn: '2026-04-01',
      harvestedOn: '2026-07-01',
      seasonYear: 2026,
    });
    expect(p).toMatchObject({ startMethod: 'direct_seed', life: 'annual', trayId: null });
    expect((await plantings.getById(p.id))?.id).toBe(p.id);
    expect(await plantings.listHarvests(garden.id)).toEqual([
      { plantingId: p.id, harvestedOn: '2026-07-01' },
    ]);
  });

  it('never reads, changes, places, or deletes a planting through another property', async () => {
    const { garden, other, plant, bed } = await setup();
    const p = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
    });
    expect(await plantings.getInGarden(other.id, p.id)).toBeNull();
    expect(await plantings.update(other.id, p.id, { note: 'hacked' })).toBeNull();
    expect(
      await plantings.setPlacement(other.id, p.id, { bedId: bed.id, xInches: 1, yInches: 1 }),
    ).toBeNull();
    expect(await plantings.clearPlacement(other.id, p.id)).toBeNull();
    expect(await plantings.delete(other.id, p.id)).toBe(false);
    expect(await plantings.getInGarden(garden.id, p.id)).toMatchObject({ note: null });
  });

  it('updates only the given fields and keeps every harvest date', async () => {
    const { garden, plant } = await setup();
    const p = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: '2026-04-01',
      harvestedOn: null,
    });
    const updated = await plantings.update(garden.id, p.id, {
      note: 'staked',
      harvestedOn: '2026-07-10',
    });
    expect(updated).toMatchObject({ note: 'staked', plantedOn: '2026-04-01' });
    await plantings.update(garden.id, p.id, { harvestedOn: '2026-08-01' });
    await plantings.update(garden.id, p.id, { harvestedOn: '2026-08-01' });
    expect((await plantings.listHarvests(garden.id)).map((h) => h.harvestedOn).sort()).toEqual([
      '2026-07-10',
      '2026-08-01',
    ]);
    await plantings.deleteHarvest(p.id, '2026-07-10');
    expect((await plantings.listHarvests(garden.id)).map((h) => h.harvestedOn)).toEqual([
      '2026-08-01',
    ]);
  });

  it('places a planting in a bed, lists it for the layout, and clears it', async () => {
    const { garden, plant, bed } = await setup();
    const p = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
    });
    expect(
      await plantings.setPlacement(garden.id, p.id, { bedId: bed.id, xInches: 12, yInches: 6 }),
    ).toMatchObject({ bedId: bed.id, layoutXInches: 12, layoutYInches: 6 });
    expect((await gardens.countsForGardenIds([garden.id])).get(garden.id)?.placementCount).toBe(1);
    expect((await plantings.listAllForLayout(garden.id)).map((r) => r.id)).toContain(p.id);
    expect((await plantings.occupants(bed.id)).length).toBe(1);

    expect(await plantings.clearLayoutCoords(garden.id, p.id)).toMatchObject({
      bedId: bed.id,
      layoutXInches: null,
    });
    await plantings.setPlacement(garden.id, p.id, { bedId: bed.id, xInches: 1, yInches: 1 });
    await plantings.clearLayoutForBed(garden.id, bed.id);
    expect(await plantings.getInGarden(garden.id, p.id)).toMatchObject({ layoutXInches: null });
    expect(await plantings.clearPlacement(garden.id, p.id)).toMatchObject({
      bedId: null,
      layoutXInches: null,
    });
  });

  it('clearing a bed deletes its direct-seeded plantings but keeps transplants', async () => {
    const { garden, plant, bed } = await setup();
    const seeded = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: bed.id,
      plantedOn: null,
      harvestedOn: null,
      startMethod: 'direct_seed',
    });
    const transplant = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: bed.id,
      plantedOn: null,
      harvestedOn: null,
      startMethod: 'transplant',
    });
    await plantings.deleteDirectSeedInBed(garden.id, bed.id);
    await plantings.unassignTransplantsInBed(garden.id, bed.id);
    expect(await plantings.getById(seeded.id)).toBeNull();
    expect(await plantings.getById(transplant.id)).toMatchObject({ bedId: null });
    expect((await plantings.listUnplacedTransplants(garden.id)).map((r) => r.id)).toEqual([
      transplant.id,
    ]);
  });

  it('moves loose transplants into a greenhouse tray', async () => {
    const { garden, plant } = await setup();
    const loose = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
      startMethod: 'transplant',
    });
    const greenhouse = await areas.ensure(garden.id, 'greenhouse');
    const tray = await trays.open(garden.id, greenhouse.id, 'Tray');
    await plantings.assignLooseTransplants(garden.id, tray.id);
    expect(await plantings.getById(loose.id)).toMatchObject({ trayId: tray.id });
    expect(await plantings.listUnplacedTransplants(garden.id)).toEqual([]);
  });

  it('while a season is open, hides annuals from other years but keeps perennials', async () => {
    const { garden, plant } = await setup();
    const lastYear = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
      seasonYear: 2025,
    });
    const thisYear = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
      seasonYear: 2026,
    });
    const tree = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
      seasonYear: 2024,
      life: 'tree',
    });
    // No open season: everything is visible.
    expect((await plantings.listByGarden(garden.id, 1, 50)).totalCount).toBe(3);

    await t.db.insert(gardenSeasons).values({ gardenId: garden.id, year: 2026, status: 'open' });
    const visible = (await plantings.listByGarden(garden.id, 1, 50)).items.map((r) => r.id);
    expect(visible.sort()).toEqual([thisYear.id, tree.id].sort());
    expect(visible).not.toContain(lastYear.id);
    expect((await plantings.listAllForReminders(garden.id)).map((r) => r.id).sort()).toEqual(
      [thisYear.id, tree.id].sort(),
    );
  });

  it('deleting a planting removes it and its harvest history', async () => {
    const { garden, plant } = await setup();
    const p = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: '2026-04-01',
      harvestedOn: '2026-06-01',
    });
    expect(await plantings.delete(garden.id, p.id)).toBe(true);
    expect(await plantings.getById(p.id)).toBeNull();
    expect(await plantings.listHarvests(garden.id)).toEqual([]);
  });
});
