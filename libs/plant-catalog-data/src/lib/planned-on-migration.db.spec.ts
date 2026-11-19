// Migration 0019: plantings dated ahead become planned (ADR 0040).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from './migrate';
import { createTestDb, insertGarden, insertUser, type TestDb } from './test-db';

const MIGRATION = readFileSync(
  resolve(process.cwd(), MIGRATIONS_FOLDER, '0019_planned_on.sql'),
  'utf8',
);

const open: TestDb[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

describe('migration 0019: planned or planted', { timeout: 30_000 }, () => {
  it('moves a future date recorded ahead to planned_on, and keeps every other date', async () => {
    const t = await createTestDb('0019');
    open.push(t);
    const user = await insertUser(t.db);
    const garden = await insertGarden(t.db, user.id);
    await t.exec(`
      insert into plants (id, variety_key, common_name, species, plant_type, zone_min, zone_max, spacing_inches)
      values ('00000000-0000-0000-0000-000000000001', 'k', 'Lettuce', 'L', 'vegetable', 3, 9, 8);
      insert into garden_plantings (id, garden_id, plant_id, planted_on, created_at) values
        -- Planned ahead and still to come: becomes planned.
        ('00000000-0000-0000-0000-0000000000a1', '${garden.id}', '00000000-0000-0000-0000-000000000001',
          current_date + 30, now()),
        -- Sown already: stays planted.
        ('00000000-0000-0000-0000-0000000000a2', '${garden.id}', '00000000-0000-0000-0000-000000000001',
          current_date - 10, now() - interval '20 days'),
        -- Recorded today for tomorrow (the time zone margin): stays planted.
        ('00000000-0000-0000-0000-0000000000a3', '${garden.id}', '00000000-0000-0000-0000-000000000001',
          current_date + 1, now()),
        -- No date: stays as it is.
        ('00000000-0000-0000-0000-0000000000a4', '${garden.id}', '00000000-0000-0000-0000-000000000001',
          null, now());
    `);

    await t.exec(MIGRATION);

    const result = await t.db.execute<{ id: string; planned: boolean; planted: boolean }>(sql`
      select right(id::text, 2) as id, planned_on is not null as planned, planted_on is not null as planted
      from garden_plantings order by id`);
    expect((result as unknown as { rows: unknown[] }).rows).toEqual([
      { id: 'a1', planned: true, planted: false },
      { id: 'a2', planned: false, planted: true },
      { id: 'a3', planned: false, planted: true },
      { id: 'a4', planned: false, planted: false },
    ]);
  });
});
