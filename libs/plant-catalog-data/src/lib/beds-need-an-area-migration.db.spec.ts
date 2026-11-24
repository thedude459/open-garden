// Migration 0022: every bed gets an area, and area_id becomes required.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from './migrate';
import * as schema from './schema';
import { createTestDb, insertGarden, insertUser, type TestDb } from './test-db';

const MIGRATION = readFileSync(
  resolve(process.cwd(), MIGRATIONS_FOLDER, '0022_beds_need_an_area.sql'),
  'utf8',
);

const open: TestDb[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

describe('migration 0022: beds need an area', { timeout: 30_000 }, () => {
  it('puts each bed without an area in its property’s area for that bed', async () => {
    const t = await createTestDb('0022');
    open.push(t);
    const user = await insertUser(t.db);
    const garden = await insertGarden(t.db, user.id);
    const [veg] = await t.db
      .insert(schema.gardenAreas)
      .values({
        gardenId: garden.id,
        name: 'Kitchen',
        nameNormalized: 'kitchen',
        kind: 'vegetable',
      })
      .returning();
    // A greenhouse already took the name a new fruit garden would get.
    await t.db.insert(schema.gardenAreas).values({
      gardenId: garden.id,
      name: 'Fruit garden',
      nameNormalized: 'fruit garden',
      kind: 'greenhouse',
    });
    const bed = (name: string, station: string | null) => ({
      gardenId: garden.id,
      name,
      nameNormalized: name.toLowerCase(),
      station,
    });
    await t.db
      .insert(schema.gardenBeds)
      .values([bed('North', null), bed('Apple', 'tree')] as never);

    await t.exec(MIGRATION);

    const areas = await t.db.select().from(schema.gardenAreas);
    const fruit = areas.find((a) => a.kind === 'fruit');
    expect(fruit?.name).toBe('Fruit garden (beds)');
    const beds = new Map((await t.db.select().from(schema.gardenBeds)).map((b) => [b.name, b]));
    expect(beds.get('North')?.areaId).toBe(veg!.id);
    expect(beds.get('Apple')?.areaId).toBe(fruit!.id);
    // From now on a bed cannot be saved without one.
    await expect(t.exec(`UPDATE garden_beds SET area_id = NULL`)).rejects.toThrow();
  });
});
