// Soil tests against a real PostgreSQL (PGlite): the latest test per area and
// per bed, scoped to one property, deleting only through the test's own owner,
// and exactly one owner per test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BedRepository } from './bed-repository';
import { GardenRepository } from './garden-repository';
import { PlantingAreaRepository } from './planting-area-repository';
import { SoilTestRepository } from './soil-test-repository';
import { gardenSoilTests } from './schema';
import { createTestDb, gardenInput, insertUser, vegetableAreaId, type TestDb } from './test-db';

let t: TestDb;
let gardens: GardenRepository;
let areas: PlantingAreaRepository;
let beds: BedRepository;
let tests: SoilTestRepository;

beforeAll(async () => {
  t = await createTestDb();
  gardens = new GardenRepository(t.db);
  areas = new PlantingAreaRepository(t.db);
  beds = new BedRepository(t.db);
  tests = new SoilTestRepository(t.db);
});
afterAll(() => t.close());

const bed = async (gardenId: string, name: string) =>
  beds.insert({
    gardenId,
    areaId: await vegetableAreaId(t.db, gardenId),
    name,
    nameNormalized: name.toLowerCase(),
    originXInches: 0,
    originYInches: 0,
    lengthInches: 96,
    widthInches: 48,
  });

const result = (testedOn: string, ph: number | null) => ({
  testedOn,
  lab: null,
  ph,
  organicMatterPct: 3.5,
  nitrogen: null,
  phosphorus: 'low' as const,
  potassium: null,
  recommendations: 'Add 2 lb lime per 100 sq ft',
});

async function property() {
  const owner = await insertUser(t.db);
  return gardens.createOwned(gardenInput(owner.id));
}

describe('SoilTestRepository', () => {
  it('gives each area and each bed of a property its latest test', async () => {
    const mine = await property();
    const other = await property();
    const veg = await areas.ensure(mine.id, 'vegetable');
    const orchard = await areas.ensure(mine.id, 'fruit');
    const north = await bed(mine.id, 'North');
    const south = await bed(mine.id, 'South');
    const elsewhere = await bed(other.id, 'North');
    await tests.insert({ bedId: north.id }, result('2025-04-01', 6.0));
    const latest = await tests.insert({ bedId: north.id }, result('2026-04-01', 6.8));
    await tests.insert({ bedId: north.id }, result('2024-04-01', 5.5));
    const areaTest = await tests.insert({ areaId: veg.id }, result('2026-03-01', 7.1));
    await tests.insert({ bedId: elsewhere.id }, result('2026-05-01', 8));

    const latestByGarden = await tests.latestByGarden(mine.id);
    expect(latestByGarden.beds.get(north.id)).toEqual(latest);
    expect(latest).toMatchObject({
      areaId: null,
      ph: 6.8,
      phosphorus: 'low',
      organicMatterPct: 3.5,
    });
    expect(latestByGarden.beds.has(south.id)).toBe(false);
    expect(latestByGarden.beds.has(elsewhere.id)).toBe(false);
    expect([...latestByGarden.areas.values()]).toEqual([areaTest]);
    expect(latestByGarden.areas.has(orchard.id)).toBe(false);
    expect(await tests.latestFor({ bedId: north.id })).toEqual(latest);
    expect(await tests.latestFor({ areaId: veg.id })).toEqual(areaTest);
  });

  it('deletes a test only through its own owner, and with its bed', async () => {
    const garden = await property();
    const veg = await areas.ensure(garden.id, 'vegetable');
    const north = await bed(garden.id, 'North');
    const south = await bed(garden.id, 'South');
    const test = await tests.insert({ bedId: north.id }, result('2026-04-01', 6.5));
    expect(await tests.delete({ bedId: south.id }, test.id)).toBe(false);
    expect(await tests.delete({ areaId: veg.id }, test.id)).toBe(false);
    expect(await tests.delete({ bedId: north.id }, test.id)).toBe(true);
    expect(await tests.latestFor({ bedId: north.id })).toBeNull();
    await tests.insert({ bedId: north.id }, result('2026-04-02', 6.5));
    const areaTest = await tests.insert({ areaId: veg.id }, result('2026-04-02', 6.5));
    await beds.delete(garden.id, north.id);
    const left = await tests.latestByGarden(garden.id);
    expect(left.beds.size).toBe(0);
    expect(left.areas.get(veg.id)).toEqual(areaTest);
  });

  it('refuses a test with no owner or with two', async () => {
    const garden = await property();
    const veg = await areas.ensure(garden.id, 'vegetable');
    const north = await bed(garden.id, 'North');
    await expect(t.db.insert(gardenSoilTests).values({ testedOn: '2026-04-01' })).rejects.toThrow();
    await expect(
      t.db
        .insert(gardenSoilTests)
        .values({ testedOn: '2026-04-01', areaId: veg.id, bedId: north.id }),
    ).rejects.toThrow();
  });
});
