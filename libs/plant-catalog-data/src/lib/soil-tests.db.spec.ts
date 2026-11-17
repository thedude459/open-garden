// Soil tests against a real PostgreSQL (PGlite): the latest test per bed,
// scoped to one property, and deleting only through its own bed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BedRepository } from './bed-repository';
import { GardenRepository } from './garden-repository';
import { SoilTestRepository } from './soil-test-repository';
import { createTestDb, gardenInput, insertUser, type TestDb } from './test-db';

let t: TestDb;
let gardens: GardenRepository;
let beds: BedRepository;
let tests: SoilTestRepository;

beforeAll(async () => {
  t = await createTestDb();
  gardens = new GardenRepository(t.db);
  beds = new BedRepository(t.db);
  tests = new SoilTestRepository(t.db);
});
afterAll(() => t.close());

const bed = (gardenId: string, name: string) =>
  beds.insert({
    gardenId,
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

describe('SoilTestRepository', () => {
  it('gives each bed of a property its latest test', async () => {
    const owner = await insertUser(t.db);
    const mine = await gardens.createOwned(gardenInput(owner.id));
    const other = await gardens.createOwned(gardenInput(owner.id));
    const north = await bed(mine.id, 'North');
    const south = await bed(mine.id, 'South');
    const elsewhere = await bed(other.id, 'North');
    await tests.insert(north.id, result('2025-04-01', 6.0));
    const latest = await tests.insert(north.id, result('2026-04-01', 6.8));
    await tests.insert(north.id, result('2024-04-01', 5.5));
    await tests.insert(elsewhere.id, result('2026-05-01', 8));

    const byBed = await tests.latestByGarden(mine.id);
    expect(byBed.get(north.id)).toEqual(latest);
    expect(await tests.latestForBed(north.id)).toEqual(latest);
    expect(latest).toMatchObject({ ph: 6.8, phosphorus: 'low', organicMatterPct: 3.5 });
    expect(byBed.has(south.id)).toBe(false);
    expect(byBed.has(elsewhere.id)).toBe(false);
  });

  it('deletes a test only through its own bed, and with the bed', async () => {
    const owner = await insertUser(t.db);
    const garden = await gardens.createOwned(gardenInput(owner.id));
    const north = await bed(garden.id, 'North');
    const south = await bed(garden.id, 'South');
    const test = await tests.insert(north.id, result('2026-04-01', 6.5));
    expect(await tests.delete(south.id, test.id)).toBe(false);
    expect(await tests.delete(north.id, test.id)).toBe(true);
    expect(await tests.latestForBed(north.id)).toBeNull();
    await tests.insert(north.id, result('2026-04-02', 6.5));
    await beds.delete(garden.id, north.id);
    expect((await tests.latestByGarden(garden.id)).size).toBe(0);
  });
});
