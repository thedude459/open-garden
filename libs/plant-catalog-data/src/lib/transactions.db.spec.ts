// What `transactionOn` guarantees, against a real PostgreSQL (PGlite): the
// multi-step writes of deleting a bed, saving a layout, and adding a
// succession series commit together or not at all.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BedRepository } from './bed-repository';
import { transactionOn } from './db';
import { GardenRepository } from './garden-repository';
import { PlantingRepository } from './planting-repository';
import { gardenPlantings } from './schema';
import {
  createTestDb,
  gardenInput,
  insertPlant,
  insertUser,
  vegetableAreaId,
  type TestDb,
} from './test-db';

let t: TestDb;
let plantings: PlantingRepository;
let beds: BedRepository;
let transaction: ReturnType<typeof txFor>;

const txFor = (db: TestDb['db']) =>
  transactionOn(db, (tx) => ({
    plantings: new PlantingRepository(tx),
    beds: new BedRepository(tx),
  }));

beforeAll(async () => {
  t = await createTestDb();
  plantings = new PlantingRepository(t.db);
  beds = new BedRepository(t.db);
  transaction = txFor(t.db);
});
afterAll(() => t.close());

/** A bed holding two direct-seeded plantings and a transplant. */
async function bedWithPlantings() {
  const owner = await insertUser(t.db);
  const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
  const plant = await insertPlant(t.db, 'Carrot');
  const bed = await beds.insert({
    gardenId: garden.id,
    areaId: await vegetableAreaId(t.db, garden.id),
    name: 'North',
    nameNormalized: 'north',
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
  });
  const sow = (startMethod: string) =>
    plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: bed.id,
      plantedOn: null,
      harvestedOn: null,
      startMethod,
    });
  const rows = [await sow('direct_seed'), await sow('direct_seed'), await sow('transplant')];
  return { garden, plant, bed, rows };
}

/** Each planting's bed and place on the plan, by id. */
async function plantingsOf(gardenId: string) {
  const rows = await t.db
    .select({
      id: gardenPlantings.id,
      bedId: gardenPlantings.bedId,
      x: gardenPlantings.layoutXInches,
      y: gardenPlantings.layoutYInches,
    })
    .from(gardenPlantings)
    .where(eq(gardenPlantings.gardenId, gardenId));
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

const lostConnection = () => {
  throw new Error('connection lost');
};

describe('deleting a bed', () => {
  async function deleteBed(
    repos: { plantings: PlantingRepository; beds: BedRepository },
    gardenId: string,
    bedId: string,
    failBeforeTheBed = false,
  ) {
    await repos.plantings.deleteDirectSeedInBed(gardenId, bedId);
    await repos.plantings.unassignTransplantsInBed(gardenId, bedId);
    if (failBeforeTheBed) lostConnection();
    await repos.beds.delete(gardenId, bedId);
  }

  it('without a transaction, a failure before the bed goes leaves its plantings deleted', async () => {
    const { garden, bed } = await bedWithPlantings();
    await expect(deleteBed({ plantings, beds }, garden.id, bed.id, true)).rejects.toThrow();
    expect(await beds.getInGarden(garden.id, bed.id)).not.toBeNull();
    expect(await plantingsOf(garden.id)).toHaveLength(1);
  });

  it('in a transaction, the same failure changes nothing', async () => {
    const { garden, bed } = await bedWithPlantings();
    const before = await plantingsOf(garden.id);
    await expect(transaction((repos) => deleteBed(repos, garden.id, bed.id, true))).rejects.toThrow(
      'connection lost',
    );
    expect(await beds.getInGarden(garden.id, bed.id)).not.toBeNull();
    expect(await plantingsOf(garden.id)).toEqual(before);
  });

  it('in a transaction that succeeds, every step is kept', async () => {
    const { garden, bed } = await bedWithPlantings();
    await transaction((repos) => deleteBed(repos, garden.id, bed.id));
    expect(await beds.getInGarden(garden.id, bed.id)).toBeNull();
    expect(await plantingsOf(garden.id)).toEqual([expect.objectContaining({ bedId: null })]);
  });
});

describe('saving a layout', () => {
  it('in a transaction, a failure after some placements keeps none of them', async () => {
    const { garden, bed, rows } = await bedWithPlantings();
    const before = await plantingsOf(garden.id);
    await expect(
      transaction(async (repos) => {
        await repos.plantings.setPlacement(garden.id, rows[0]!.id, {
          bedId: bed.id,
          xInches: 6,
          yInches: 6,
        });
        await repos.plantings.setPlacement(garden.id, rows[1]!.id, {
          bedId: bed.id,
          xInches: 18,
          yInches: 6,
        });
        lostConnection();
      }),
    ).rejects.toThrow('connection lost');
    expect(await plantingsOf(garden.id)).toEqual(before);
  });
});

describe('adding a succession series', () => {
  it('in a transaction, a failure part-way adds no sowings', async () => {
    const { garden, plant } = await bedWithPlantings();
    const sowing = (plannedOn: string) => ({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plannedOn,
      plantedOn: null,
      harvestedOn: null,
    });
    await expect(
      transaction(async (repos) => {
        await repos.plantings.insert(sowing('2026-05-01'));
        await repos.plantings.insert(sowing('2026-05-15'));
        lostConnection();
      }),
    ).rejects.toThrow('connection lost');
    expect(await plantingsOf(garden.id)).toHaveLength(3);
  });
});
