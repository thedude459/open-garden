// Migration 0003: plants from the fixture and Perenual sources move to
// open-garden-data ids without any planting losing its plant.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppDatabase } from './db';
import { MIGRATIONS_FOLDER } from './migrate';
import { PlantRepository } from './plant-repository';
import * as schema from './schema';
import { createTestDb, insertGarden, insertUser, type TestDb } from './test-db';

const MIGRATION = readFileSync(
  resolve(process.cwd(), MIGRATIONS_FOLDER, '0003_map_plants_to_dataset.sql'),
  'utf8',
);

const open: TestDb[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

// Raw SQL: the schema in code has columns later migrations add.
async function plant(db: AppDatabase, varietyKey: string, commonName: string) {
  const result = await db.execute<{ id: string }>(sql`
    insert into plants (variety_key, common_name, species, plant_type, zone_min, zone_max, spacing_inches)
    values (${varietyKey}, ${commonName}, 'Any', 'vegetable', 3, 9, 12)
    returning id`);
  return { id: (result as unknown as { rows: { id: string }[] }).rows[0]!.id };
}

/** Migrations after 0003, so the code's schema matches the database again. */
async function migrateRest(t: TestDb) {
  const folder = resolve(process.cwd(), MIGRATIONS_FOLDER);
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith('.sql') && f > '0004')
    .sort()) {
    await t.exec(readFileSync(resolve(folder, file), 'utf8'));
  }
}

async function household(db: AppDatabase) {
  const user = await insertUser(db);
  const garden = await insertGarden(db, user.id);
  return { user, garden: garden };
}

async function plantRow(db: AppDatabase, id: string) {
  const [row] = await db.select().from(schema.plants).where(eq(schema.plants.id, id));
  return row!;
}

describe('migration 0003: map plants to the dataset', { timeout: 30_000 }, () => {
  it('gives a fixture plant its dataset id in place and deprecates plants with no match', async () => {
    const t = await createTestDb('0003');
    open.push(t);
    const { user, garden } = await household(t.db);
    const tomato = await plant(t.db, 'solanum lycopersicum|cherry', 'Cherry Tomato');
    const maple = await plant(t.db, 'acer rubrum|', 'Red Maple');
    const [planting] = await t.db
      .insert(schema.gardenPlantings)
      .values({ gardenId: garden.id, plantId: tomato.id })
      .returning();
    await t.db.insert(schema.gardenPlantings).values({ gardenId: garden.id, plantId: maple.id });
    await t.db.insert(schema.favorites).values({ userId: user.id, plantId: tomato.id });

    await t.exec(MIGRATION);
    await migrateRest(t);

    expect(await plantRow(t.db, tomato.id)).toMatchObject({
      varietyKey: 'dataset:tomato-cherry',
      status: 'active',
    });
    // No dataset equivalent: the row stays, so the planting keeps its plant.
    expect(await plantRow(t.db, maple.id)).toMatchObject({
      varietyKey: 'acer rubrum|',
      status: 'deprecated',
    });

    // The next import fills the same row with dataset values.
    const imported = await new PlantRepository(t.db).upsertByVarietyKey({
      varietyKey: 'dataset:tomato-cherry',
      commonName: 'Tomato',
      species: 'Solanum lycopersicum',
      cultivar: 'Cherry',
      plantType: 'vegetable',
      zoneMin: 1,
      zoneMax: 13,
      sunRequirements: 'Full sun',
      waterNeeds: 'Moderate',
      daysToMaturity: 55,
      spacingInches: 18,
      provider: 'dataset',
      providerExternalId: 'tomato-cherry',
    });
    expect(imported?.id).toBe(tomato.id);
    const [kept] = await t.db
      .select()
      .from(schema.gardenPlantings)
      .where(eq(schema.gardenPlantings.id, planting!.id));
    expect(kept?.plantId).toBe(tomato.id);
  });

  it('moves references onto a dataset plant that already exists', async () => {
    const t = await createTestDb('0003');
    open.push(t);
    const { user, garden } = await household(t.db);
    const oldBasil = await plant(t.db, 'ocimum basilicum|genovese', 'Sweet Basil');
    const basil = await plant(t.db, 'dataset:basil-genovese', 'Basil');
    const tomato = await plant(t.db, 'dataset:tomato', 'Tomato');
    await t.db.insert(schema.gardenPlantings).values({ gardenId: garden.id, plantId: oldBasil.id });
    // The garden already follows both on its calendar, and the user favorited both.
    await t.db.insert(schema.gardenCalendarEntries).values([
      { gardenId: garden.id, plantId: oldBasil.id },
      { gardenId: garden.id, plantId: basil.id },
    ]);
    await t.db.insert(schema.favorites).values([
      { userId: user.id, plantId: oldBasil.id },
      { userId: user.id, plantId: basil.id },
    ]);
    // A pair that duplicates one the household has, one that survives, and one
    // that would pair basil with itself.
    await t.db.insert(schema.companionPairs).values([
      {
        gardenId: garden.id,
        plantId: oldBasil.id,
        otherPlantId: tomato.id,
        kind: 'helps',
        reason: 'old',
      },
      {
        gardenId: garden.id,
        plantId: basil.id,
        otherPlantId: tomato.id,
        kind: 'helps',
        reason: 'new',
      },
      {
        gardenId: garden.id,
        plantId: tomato.id,
        otherPlantId: oldBasil.id,
        kind: 'hinders',
        reason: 'kept',
      },
      {
        gardenId: garden.id,
        plantId: oldBasil.id,
        otherPlantId: basil.id,
        kind: 'pollinates',
        reason: 'self',
      },
    ]);

    await t.exec(MIGRATION);
    await migrateRest(t);

    const plantings = await t.db.select().from(schema.gardenPlantings);
    expect(plantings.map((p) => p.plantId)).toEqual([basil.id]);
    const calendar = await t.db.select().from(schema.gardenCalendarEntries);
    expect(calendar.map((c) => c.plantId)).toEqual([basil.id]);
    const favorites = await t.db.select().from(schema.favorites);
    expect(favorites.map((f) => f.plantId)).toEqual([basil.id]);
    const pairs = await t.db.select().from(schema.companionPairs);
    expect(pairs.map((p) => [p.reason, p.plantId, p.otherPlantId]).sort()).toEqual([
      ['kept', tomato.id, basil.id],
      ['new', basil.id, tomato.id],
    ]);
    expect(await plantRow(t.db, oldBasil.id)).toMatchObject({
      varietyKey: 'ocimum basilicum|genovese',
      status: 'deprecated',
    });
    expect((await plantRow(t.db, basil.id)).status).toBe('active');
  });
});
