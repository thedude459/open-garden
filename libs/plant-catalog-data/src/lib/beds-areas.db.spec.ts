// Repository integration tests against a real PostgreSQL (PGlite): beds,
// non-planting areas, typed planting areas, trays, and favorites. Every
// garden-scoped call must leave other properties' rows alone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AreaRepository } from './area-repository';
import { BedRepository } from './bed-repository';
import { FavoriteRepository } from './favorite-repository';
import { GardenRepository } from './garden-repository';
import { PlantingAreaRepository } from './planting-area-repository';
import { TrayRepository } from './tray-repository';
import { createTestDb, gardenInput, insertPlant, insertUser, type TestDb } from './test-db';

let t: TestDb;
let gardens: GardenRepository;
let beds: BedRepository;
let areas: AreaRepository;
let plantingAreas: PlantingAreaRepository;
let trays: TrayRepository;
let favorites: FavoriteRepository;

beforeAll(async () => {
  t = await createTestDb();
  gardens = new GardenRepository(t.db);
  beds = new BedRepository(t.db);
  areas = new AreaRepository(t.db);
  plantingAreas = new PlantingAreaRepository(t.db);
  trays = new TrayRepository(t.db);
  favorites = new FavoriteRepository(t.db);
});
afterAll(() => t.close());

async function twoGardens() {
  const owner = await insertUser(t.db);
  const mine = await gardens.createOwned(gardenInput(owner.id));
  const other = await gardens.createOwned(gardenInput(owner.id));
  return { owner, mine, other };
}

const bedInput = (gardenId: string, name: string) => ({
  gardenId,
  name,
  nameNormalized: name.toLowerCase(),
  originXInches: 12,
  originYInches: 24,
  lengthInches: 96,
  widthInches: 48,
});

describe('BedRepository', () => {
  it('inserts with defaults and finds beds by garden and name', async () => {
    const { mine } = await twoGardens();
    const bed = await beds.insert(bedInput(mine.id, 'North'));
    expect(bed).toMatchObject({ orientation: 0, kind: 'bed', sun: null, name: 'North' });
    expect((await beds.getById(bed.id))?.id).toBe(bed.id);
    expect((await beds.getInGarden(mine.id, bed.id))?.id).toBe(bed.id);
    expect((await beds.findByNormalizedName(mine.id, 'north'))?.id).toBe(bed.id);
    expect((await beds.listByGarden(mine.id)).map((b) => b.name)).toEqual(['North']);
  });

  it('never reads or changes a bed through another property', async () => {
    const { mine, other } = await twoGardens();
    const bed = await beds.insert(bedInput(mine.id, 'Guarded'));
    expect(await beds.getInGarden(other.id, bed.id)).toBeNull();
    expect(await beds.findByNormalizedName(other.id, 'guarded')).toBeNull();
    expect(await beds.rename(other.id, bed.id, 'Hacked', 'hacked')).toBeNull();
    expect(await beds.setSite(other.id, bed.id, { sun: 'full' })).toBeNull();
    expect(
      await beds.setGeometry(other.id, bed.id, {
        originXInches: 0,
        originYInches: 0,
        lengthInches: 1,
        widthInches: 1,
        orientation: 90,
      }),
    ).toBeNull();
    expect(await beds.clearGeometry(other.id, bed.id)).toBeNull();
    expect(await beds.delete(other.id, bed.id)).toBe(false);
    expect(await beds.getInGarden(mine.id, bed.id)).toMatchObject({ name: 'Guarded', sun: null });
  });

  it('renames, sets site details, moves, clears geometry, and deletes', async () => {
    const { mine } = await twoGardens();
    const bed = await beds.insert(bedInput(mine.id, 'Old'));
    expect((await beds.rename(mine.id, bed.id, 'New', 'new'))?.name).toBe('New');
    expect(
      await beds.setSite(mine.id, bed.id, { sun: 'part', site: 'raised', mulch: 'straw' }),
    ).toMatchObject({ sun: 'part', site: 'raised', mulch: 'straw' });
    expect(
      await beds.setGeometry(mine.id, bed.id, {
        originXInches: 1,
        originYInches: 2,
        lengthInches: 30,
        widthInches: 20,
        orientation: 270,
      }),
    ).toMatchObject({ originXInches: 1, lengthInches: 30, orientation: 270 });
    expect(await beds.clearGeometry(mine.id, bed.id)).toMatchObject({
      originXInches: null,
      lengthInches: null,
      orientation: 0,
    });
    expect(await beds.delete(mine.id, bed.id)).toBe(true);
    expect(await beds.getById(bed.id)).toBeNull();
  });

  it('rejects a second bed with the same name in one property', async () => {
    const { mine, other } = await twoGardens();
    await beds.insert(bedInput(mine.id, 'Same'));
    await expect(beds.insert(bedInput(mine.id, 'Same'))).rejects.toThrow();
    await expect(beds.insert(bedInput(other.id, 'Same'))).resolves.toMatchObject({ name: 'Same' });
  });
});

describe('AreaRepository (non-planting areas)', () => {
  it('upserts by id, stays inside its property, and deletes', async () => {
    const { mine, other } = await twoGardens();
    const id = crypto.randomUUID();
    const area = {
      id,
      name: 'Path',
      nameNormalized: 'path',
      originXInches: 0,
      originYInches: 0,
      lengthInches: 48,
      widthInches: 24,
    };
    expect(await areas.upsert(mine.id, area)).toMatchObject({ id, name: 'Path' });
    expect(
      await areas.upsert(mine.id, {
        ...area,
        name: 'Walkway',
        nameNormalized: 'walkway',
        lengthInches: 60,
      }),
    ).toMatchObject({ id, name: 'Walkway', lengthInches: 60 });
    expect((await areas.listByGarden(mine.id)).map((a) => a.name)).toEqual(['Walkway']);
    expect((await areas.findByNormalizedName(mine.id, 'walkway'))?.id).toBe(id);
    expect(await areas.getInGarden(other.id, id)).toBeNull();
    expect(await areas.delete(other.id, id)).toBe(false);
    expect(await areas.delete(mine.id, id)).toBe(true);
    expect(await areas.listByGarden(mine.id)).toEqual([]);
  });
});

describe('PlantingAreaRepository and TrayRepository', () => {
  it('ensure reuses the first area of a kind; add numbers further ones', async () => {
    const { mine, other } = await twoGardens();
    expect(await plantingAreas.hasKind(mine.id, 'vegetable')).toBe(false);
    const first = await plantingAreas.ensure(mine.id, 'vegetable');
    expect((await plantingAreas.ensure(mine.id, 'vegetable')).id).toBe(first.id);
    expect(await plantingAreas.hasKind(mine.id, 'vegetable')).toBe(true);
    const second = await plantingAreas.add(mine.id, 'vegetable');
    expect(second.name).toBe(`${first.name} 2`);
    expect((await plantingAreas.listByGarden(mine.id)).length).toBe(2);
    expect((await plantingAreas.getById(first.id))?.kind).toBe('vegetable');
    expect(await plantingAreas.getInGarden(other.id, first.id)).toBeNull();
    expect(await plantingAreas.findByKind(other.id, 'vegetable')).toBeNull();
  });

  it('the database only accepts known area kinds', async () => {
    const { mine } = await twoGardens();
    await expect(plantingAreas.ensure(mine.id, 'bramble' as never)).rejects.toThrow();
  });

  it('opening a tray by an existing name returns that tray', async () => {
    const { mine, other } = await twoGardens();
    const greenhouse = await plantingAreas.ensure(mine.id, 'greenhouse');
    const tray = await trays.open(mine.id, greenhouse.id, '  Seed tray A ');
    expect(tray.name).toBe('Seed tray A');
    expect((await trays.open(mine.id, greenhouse.id, 'seed tray a')).id).toBe(tray.id);
    expect((await trays.listByGarden(mine.id)).map((x) => x.id)).toEqual([tray.id]);
    expect((await trays.getInGarden(mine.id, tray.id))?.id).toBe(tray.id);
    expect(await trays.getInGarden(other.id, tray.id)).toBeNull();
  });
});

describe('FavoriteRepository', () => {
  it('adds once, keeps the latest client mutation id, lists, and removes', async () => {
    const user = await insertUser(t.db);
    const someoneElse = await insertUser(t.db);
    const tomato = await insertPlant(t.db, 'Fav Tomato');
    const basil = await insertPlant(t.db, 'Fav Basil');

    const added = await favorites.add(user.id, tomato.id);
    expect((await favorites.add(user.id, tomato.id))?.id).toBe(added?.id);
    expect((await favorites.add(user.id, tomato.id, 'm-2'))?.clientMutationId).toBe('m-2');
    await favorites.add(user.id, basil.id);

    expect(await favorites.isFavorite(user.id, tomato.id)).toBe(true);
    expect(await favorites.isFavorite(someoneElse.id, tomato.id)).toBe(false);
    const list = await favorites.listForUser(user.id, 1, 20);
    expect(list.totalCount).toBe(2);
    expect((await favorites.listForUser(someoneElse.id, 1, 20)).totalCount).toBe(0);

    await favorites.remove(user.id, tomato.id);
    expect(await favorites.isFavorite(user.id, tomato.id)).toBe(false);
  });
});
