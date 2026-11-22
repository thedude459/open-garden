// Migration 0020: calendar picks become planned plantings (ADR 0040).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from './migrate';
import { createTestDb, insertGarden, insertUser, type TestDb } from './test-db';

const MIGRATION = readFileSync(
  resolve(process.cwd(), MIGRATIONS_FOLDER, '0020_retire_calendar_entries.sql'),
  'utf8',
);

const open: TestDb[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

describe('migration 0020: retire calendar entries', { timeout: 30_000 }, () => {
  it('plans each calendar crop without a planting this season, then drops the list', async () => {
    const t = await createTestDb('0020');
    open.push(t);
    const user = await insertUser(t.db);
    const garden = await insertGarden(t.db, user.id);
    const g = garden.id;
    const plant = (n: string, type: string) =>
      `('00000000-0000-0000-0000-00000000000${n}', 'k${n}', 'Crop ${n}', 'S', '${type}', 3, 9, 12)`;
    await t.exec(`
      insert into plants (id, variety_key, common_name, species, plant_type, zone_min, zone_max, spacing_inches)
      values ${plant('1', 'vegetable')}, ${plant('2', 'vegetable')}, ${plant('3', 'tree')},
        ${plant('4', 'vegetable')};
      insert into garden_seasons (garden_id, year, status) values ('${g}', 2026, 'open');
      -- Crop 2 already grows this season; crop 4 only grew last season.
      insert into garden_plantings (garden_id, plant_id, season_year) values
        ('${g}', '00000000-0000-0000-0000-000000000002', 2026),
        ('${g}', '00000000-0000-0000-0000-000000000004', 2025);
      insert into garden_calendar_entries (garden_id, plant_id) values
        ('${g}', '00000000-0000-0000-0000-000000000001'),
        ('${g}', '00000000-0000-0000-0000-000000000002'),
        ('${g}', '00000000-0000-0000-0000-000000000003'),
        ('${g}', '00000000-0000-0000-0000-000000000004');
    `);

    await t.exec(MIGRATION);

    const result = await t.db.execute<{ crop: string; season: number; life: string }>(sql`
      select right(plant_id::text, 1) as crop, season_year as season, life
      from garden_plantings order by crop, season_year`);
    expect((result as unknown as { rows: unknown[] }).rows).toEqual([
      { crop: '1', season: 2026, life: 'annual' },
      { crop: '2', season: 2026, life: 'annual' },
      { crop: '3', season: 2026, life: 'tree' },
      { crop: '4', season: 2025, life: 'annual' },
      { crop: '4', season: 2026, life: 'annual' },
    ]);
    const table = await t.db.execute<{ name: string | null }>(
      sql`select to_regclass('garden_calendar_entries')::text as name`,
    );
    expect((table as unknown as { rows: { name: string | null }[] }).rows[0]!.name).toBeNull();
  });
});
