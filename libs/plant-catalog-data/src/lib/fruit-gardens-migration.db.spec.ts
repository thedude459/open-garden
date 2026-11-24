// Migration 0021: orchards and bramble patches become fruit gardens.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from './migrate';
import * as schema from './schema';
import { createTestDb, insertGarden, insertUser, type TestDb } from './test-db';

const MIGRATION = readFileSync(
  resolve(process.cwd(), MIGRATIONS_FOLDER, '0021_fruit_gardens.sql'),
  'utf8',
);

const open: TestDb[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

describe('migration 0021: fruit gardens', { timeout: 30_000 }, () => {
  it('retypes orchards and bramble patches, keeping names and beds', async () => {
    const t = await createTestDb('0021');
    open.push(t);
    const user = await insertUser(t.db);
    const garden = await insertGarden(t.db, user.id);
    const area = (name: string, kind: string) => ({
      gardenId: garden.id,
      name,
      nameNormalized: name.toLowerCase(),
      kind,
    });
    const [orchard] = await t.db
      .insert(schema.gardenAreas)
      .values([
        area('Orchard', 'orchard'),
        area('Bramble patch', 'bramble'),
        area('Veg', 'vegetable'),
        area('Greenhouse', 'greenhouse'),
      ])
      .returning();
    await t.db.insert(schema.gardenBeds).values({
      gardenId: garden.id,
      name: 'Apple',
      nameNormalized: 'apple',
      areaId: orchard!.id,
      station: 'tree',
    });

    await t.exec(MIGRATION);

    const areas = await t.db
      .select()
      .from(schema.gardenAreas)
      .where(eq(schema.gardenAreas.gardenId, garden.id));
    expect(Object.fromEntries(areas.map((a) => [a.name, a.kind]))).toEqual({
      Orchard: 'fruit',
      'Bramble patch': 'fruit',
      Veg: 'vegetable',
      Greenhouse: 'greenhouse',
    });
    const [bed] = await t.db.select().from(schema.gardenBeds);
    expect(bed).toMatchObject({ areaId: orchard!.id, station: 'tree' });
  });
});
