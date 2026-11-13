// Repository integration tests against a real PostgreSQL (PGlite): the plant
// catalog, calendar entries, care events, seasons and companion pairs, and the
// catalog pipeline's settings and source links.
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BedRepository } from './bed-repository';
import { CalendarEntryRepository } from './calendar-entry-repository';
import { CareEventRepository } from './care-event-repository';
import { GardenRepository } from './garden-repository';
import { PlantRepository, type PlantUpsertInput } from './plant-repository';
import { PlantSourceRepository } from './plant-source-repository';
import { PlantingRepository } from './planting-repository';
import { createTestDb, gardenInput, insertPlant, insertUser, type TestDb } from './test-db';
import { YearRecordRepository } from './year-record-repository';

let t: TestDb;
let plantsRepo: PlantRepository;

beforeAll(async () => {
  t = await createTestDb();
  plantsRepo = new PlantRepository(t.db);
});
afterAll(() => t.close());

const variety = (key: string, over: Partial<PlantUpsertInput> = {}): PlantUpsertInput => ({
  varietyKey: key,
  commonName: `Name ${key}`,
  species: 'Solanum lycopersicum',
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 4,
  zoneMax: 9,
  sunRequirements: 'Full sun',
  waterNeeds: 'Moderate',
  daysToMaturity: 60,
  spacingInches: 18,
  provider: 'fixture',
  providerExternalId: key,
  ...over,
});

describe('PlantRepository', () => {
  it('upserts by variety key: inserts once, then updates the same row', async () => {
    const first = await plantsRepo.upsertByVarietyKey(variety('cat-a'));
    const again = await plantsRepo.upsertByVarietyKey(variety('cat-a', { daysToMaturity: 70 }));
    expect(again?.id).toBe(first?.id);
    expect((await plantsRepo.getById(first!.id))?.daysToMaturity).toBe(70);
  });

  it('stores valid growing windows and drops nonsensical ones', async () => {
    const ok = await plantsRepo.upsertByVarietyKey(
      variety('cat-guidance', {
        growingGuidance: {
          indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
          outdoorSow: { frostAnchor: 'last', weeksEarliest: 4, weeksLatest: 1 },
          transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 99 },
          fallSow: { frostAnchor: 'first', weeksEarliest: -8, weeksLatest: -4 },
        },
      }),
    );
    const row = await plantsRepo.getById(ok!.id);
    expect(row).toMatchObject({ indoorFrostAnchor: 'last', indoorWeeksEarliest: -8 });
    expect(row).toMatchObject({ fallSowWeeksEarliest: -8, fallSowWeeksLatest: -4 });
    // Earliest after latest, and more than a year out, are both rejected.
    expect(row).toMatchObject({ sowFrostAnchor: null, transplantFrostAnchor: null });
  });

  it('stores a fall sowing only when it counts from the first frost', async () => {
    const spring = await plantsRepo.upsertByVarietyKey(
      variety('cat-fall-last', {
        growingGuidance: {
          indoorStart: null,
          outdoorSow: null,
          transplant: null,
          fallSow: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -4 },
        },
      }),
    );
    expect(await plantsRepo.getById(spring!.id)).toMatchObject({ fallSowWeeksEarliest: null });
  });

  it('stores soil pH', async () => {
    const [row] = await plantsRepo.upsertManyByVarietyKey([
      variety('cat-ph', { soilPh: { min: 4.5, max: 5.5 } }),
    ]);
    expect(await plantsRepo.getById(row!.id)).toMatchObject({ soilPhMin: 4.5, soilPhMax: 5.5 });
  });

  it('lists with search, zone, type, and paging; hides deprecated and spacing-less plants', async () => {
    await plantsRepo.upsertManyByVarietyKey([
      variety('list-tomato', { commonName: 'Listing Tomato' }),
      variety('list-palm', { commonName: 'Listing Palm', zoneMin: 10, zoneMax: 11 }),
      variety('list-basil', { commonName: 'Listing Basil', plantType: 'herb' }),
      variety('list-nospace', { commonName: 'Listing Nospace', spacingInches: null }),
      variety('list-old', { commonName: 'Listing Old' }),
    ]);
    await plantsRepo.deprecateByVarietyKeys(['list-old']);
    const names = async (f: Partial<Parameters<PlantRepository['list']>[0]>) =>
      (await plantsRepo.list({ page: 1, pageSize: 50, q: 'Listing', ...f })).items.map(
        (p) => p.commonName,
      );
    expect(await names({})).toEqual(['Listing Basil', 'Listing Palm', 'Listing Tomato']);
    expect(await names({ zone: 6 })).toEqual(['Listing Basil', 'Listing Tomato']);
    expect(await names({ plantType: 'herb' })).toEqual(['Listing Basil']);
    expect(await names({ includeDeprecated: true })).toContain('Listing Old');
    expect(await names({ q: 'lycopersicum' })).toContain('Listing Tomato');
    const paged = await plantsRepo.list({ page: 2, pageSize: 2, q: 'Listing' });
    expect(paged.items.map((p) => p.commonName)).toEqual(['Listing Tomato']);
    expect(paged.totalCount).toBe(3);
  });

  it("stores a tree's spacing by rootstock, on insert and on update", async () => {
    const spacing = { dwarf: 94, semiDwarf: 165, standard: null };
    await plantsRepo.upsertByVarietyKey(variety('rs-apple', { rootstockSpacingInches: spacing }));
    const [inserted] = (await plantsRepo.list({ page: 1, pageSize: 5, q: 'rs-apple' })).items;
    expect(inserted).toMatchObject({ dwarfSpacingInches: 94, standardSpacingInches: null });
    await plantsRepo.upsertManyByVarietyKey([
      variety('rs-apple', { rootstockSpacingInches: { ...spacing, standard: 295 } }),
    ]);
    const updated = await plantsRepo.getById(inserted!.id);
    expect(updated).toMatchObject({ semiDwarfSpacingInches: 165, standardSpacingInches: 295 });
  });

  it('treats % and _ in a search as literal characters', async () => {
    await plantsRepo.upsertByVarietyKey(variety('pct', { commonName: 'Odd 100% Plant' }));
    await plantsRepo.upsertByVarietyKey(variety('pct2', { commonName: 'Odd 1000 Plant' }));
    const hits = await plantsRepo.list({ page: 1, pageSize: 10, q: '100%' });
    expect(hits.items.map((p) => p.commonName)).toEqual(['Odd 100% Plant']);
  });

  it('deprecates by key and reports how many rows changed', async () => {
    await plantsRepo.upsertByVarietyKey(variety('dep-1'));
    expect(await plantsRepo.deprecateByVarietyKeys(['dep-1', 'missing'])).toBe(1);
    expect(await plantsRepo.deprecateByVarietyKeys([])).toBe(0);
    const snap = await plantsRepo.listSnapshots();
    expect(snap.find((s) => s.varietyKey === 'dep-1')?.status).toBe('deprecated');
  });
});

describe('CalendarEntryRepository and CareEventRepository', () => {
  it('adds a plant to a property calendar once, lists, and removes it', async () => {
    const owner = await insertUser(t.db);
    const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
    const plant = await insertPlant(t.db, 'Calendar Plant');
    const calendar = new CalendarEntryRepository(t.db);
    expect(await calendar.insert(garden.id, plant.id)).toEqual({ created: true });
    expect(await calendar.insert(garden.id, plant.id)).toEqual({ created: false });
    expect((await calendar.listByGarden(garden.id, 1, 20)).totalCount).toBe(1);
    await calendar.delete(garden.id, plant.id);
    expect((await calendar.listByGarden(garden.id, 1, 20)).totalCount).toBe(0);
  });

  it('lists planted crops too, flagged, and keeps them after their plan entry is removed', async () => {
    const owner = await insertUser(t.db);
    const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
    const planned = await insertPlant(t.db, 'Planned Plant');
    const both = await insertPlant(t.db, 'Both Plant');
    const calendar = new CalendarEntryRepository(t.db);
    await calendar.insert(garden.id, planned.id);
    await calendar.insert(garden.id, both.id);
    await new PlantingRepository(t.db).insert({
      gardenId: garden.id,
      plantId: both.id,
      bedId: null,
      plantedOn: null,
      harvestedOn: null,
    });
    const flags = async () =>
      (await calendar.listByGarden(garden.id, 1, 20)).items.map((row) => [
        row.commonName,
        row.planned,
        row.planted,
      ]);
    expect(await flags()).toEqual([
      ['Both Plant', true, true],
      ['Planned Plant', true, false],
    ]);
    await calendar.delete(garden.id, both.id);
    expect(await flags()).toEqual([
      ['Both Plant', false, true],
      ['Planned Plant', true, false],
    ]);
    expect((await calendar.listByGarden(garden.id, 1, 1)).totalCount).toBe(2);
  });

  it('records one care event per planting, kind, and day; later actions replace earlier ones', async () => {
    const owner = await insertUser(t.db);
    const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
    const plant = await insertPlant(t.db);
    const planting = await new PlantingRepository(t.db).insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: null,
      plantedOn: '2026-04-01',
      harvestedOn: null,
    });
    const care = new CareEventRepository(t.db);
    await care.upsertEvent(planting.id, 'water', '2026-05-01', 'completed');
    await care.upsertEvent(planting.id, 'water', '2026-05-01', 'dismissed');
    await care.upsertEvent(planting.id, 'fertilize', '2026-05-01', 'completed');
    expect((await care.listForGarden(garden.id)).length).toBe(2);
    await care.deleteEvent(planting.id, 'water', '2026-05-01');
    expect((await care.listForGarden(garden.id)).map((e) => e.kind)).toEqual(['fertilize']);
  });
});

describe('YearRecordRepository', () => {
  it('closing a season opens the next and carries perennials forward', async () => {
    const owner = await insertUser(t.db);
    const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
    const plant = await insertPlant(t.db, 'Season Plant');
    const bed = await new BedRepository(t.db).insert({
      gardenId: garden.id,
      name: 'Rotation bed',
      nameNormalized: 'rotation bed',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 48,
      widthInches: 48,
    });
    const plantings = new PlantingRepository(t.db);
    const annual = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: bed.id,
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
      seasonYear: 2026,
      life: 'tree',
    });
    const seasons = new YearRecordRepository(t.db);
    expect(await seasons.openYear(garden.id)).toBeNull();

    const closed = await seasons.close(garden.id, new Date('2026-11-01T00:00:00Z'));
    expect(closed).toEqual({ closedYear: 2026, openYear: 2027 });
    expect(await seasons.openYear(garden.id)).toBe(2027);
    expect((await plantings.getById(tree.id))?.seasonYear).toBe(2027);
    expect((await plantings.getById(annual.id))?.seasonYear).toBe(2026);

    // Last year's annual in this bed shows up as rotation advice and "plant again".
    await t.db
      .update(schema.plants)
      .set({ family: 'Cabbage family' })
      .where(eq(schema.plants.id, plant.id));
    const advice = await seasons.layoutAdvice(garden.id);
    expect(advice.prior).toEqual([
      { bedId: bed.id, plantId: plant.id, commonName: 'Season Plant', family: 'Cabbage family' },
    ]);
    const snapshot = await seasons.snapshot(garden.id);
    expect(JSON.stringify(snapshot)).toContain('Rotation bed');

    // A planting added after closing 2026 (still in 2026) belongs to 2027.
    const next = await plantings.insert({
      gardenId: garden.id,
      plantId: plant.id,
      bedId: bed.id,
      plantedOn: null,
      harvestedOn: null,
    });
    expect(next.seasonYear).toBe(2027);
  });

  it('stores one companion pair per kind and updates its reason', async () => {
    const owner = await insertUser(t.db);
    const garden = await new GardenRepository(t.db).createOwned(gardenInput(owner.id));
    const tomato = await insertPlant(t.db, 'Pair Tomato');
    const basil = await insertPlant(t.db, 'Pair Basil');
    const seasons = new YearRecordRepository(t.db);
    const pair = { gardenId: garden.id, plantId: tomato.id, otherPlantId: basil.id, kind: 'helps' };
    await seasons.addPair({ ...pair, reason: 'first' });
    await seasons.addPair({ ...pair, reason: 'updated' });
    const pairs = await seasons.listPairs(garden.id);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      plantName: 'Pair Tomato',
      otherName: 'Pair Basil',
      reason: 'updated',
    });
  });
});

describe('PlantSourceRepository', () => {
  it('replaces a plant’s source links', async () => {
    const plant = await insertPlant(t.db);
    const sources = new PlantSourceRepository(t.db);
    await sources.replaceForPlant(plant.id, [
      { sourceId: 'fixture', externalId: 'a' },
      { sourceId: 'other', externalId: 'b' },
    ]);
    await sources.replaceForPlant(plant.id, [{ sourceId: 'fixture', externalId: 'c' }]);
    const mine = (await sources.listAll()).filter((l) => l.plantId === plant.id);
    expect(mine.map((l) => [l.sourceId, l.externalId])).toEqual([['fixture', 'c']]);
    await sources.replaceForPlant(plant.id, []);
    expect((await sources.listAll()).filter((l) => l.plantId === plant.id)).toEqual([]);
  });
});
