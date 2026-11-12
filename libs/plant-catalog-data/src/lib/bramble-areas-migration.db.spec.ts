// Migration 0004: berry beds leave the orchard for a bramble patch, and a
// bed's station follows its area.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from './migrate';
import * as schema from './schema';
import { createTestDb, insertGarden, insertUser, type TestDb } from './test-db';

const MIGRATION = readFileSync(
  resolve(process.cwd(), MIGRATIONS_FOLDER, '0004_bramble_areas.sql'),
  'utf8',
);

const open: TestDb[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

describe('migration 0004: bramble areas', { timeout: 30_000 }, () => {
  it('moves berry beds to a bramble patch and lines stations up with areas', async () => {
    const t = await createTestDb('0004');
    open.push(t);
    const user = await insertUser(t.db);
    const garden = await insertGarden(t.db, user.id);
    const [orchard, vegetable] = await t.db
      .insert(schema.gardenAreas)
      .values([
        { gardenId: garden.id, name: 'Orchard', nameNormalized: 'orchard', kind: 'orchard' },
        { gardenId: garden.id, name: 'Veg', nameNormalized: 'veg', kind: 'vegetable' },
      ])
      .returning();
    const bed = (name: string, areaId: string, station: string | null) => ({
      gardenId: garden.id,
      name,
      nameNormalized: name.toLowerCase(),
      areaId,
      station,
    });
    await t.db
      .insert(schema.gardenBeds)
      .values([
        bed('Raspberries', orchard!.id, 'berry'),
        bed('Apple', orchard!.id, 'tree'),
        bed('Old orchard bed', orchard!.id, null),
        bed('North', vegetable!.id, 'tree'),
      ]);

    await t.exec(MIGRATION);

    const areas = await t.db
      .select()
      .from(schema.gardenAreas)
      .where(eq(schema.gardenAreas.gardenId, garden.id));
    const bramble = areas.find((a) => a.kind === 'bramble');
    expect(bramble?.name).toBe('Bramble patch');
    const beds = await t.db.select().from(schema.gardenBeds);
    const byName = new Map(beds.map((b) => [b.name, b]));
    expect(byName.get('Raspberries')).toMatchObject({ areaId: bramble!.id, station: 'berry' });
    expect(byName.get('Apple')).toMatchObject({ areaId: orchard!.id, station: 'tree' });
    expect(byName.get('Old orchard bed')?.station).toBe('tree');
    expect(byName.get('North')?.station).toBeNull();

    // Area kinds are no longer limited by a constraint.
    await expect(
      t.db.insert(schema.gardenAreas).values({
        gardenId: garden.id,
        name: 'Bramble patch 2',
        nameNormalized: 'bramble patch 2',
        kind: 'bramble',
      }),
    ).resolves.toBeDefined();
  });
});
