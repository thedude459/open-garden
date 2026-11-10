import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { AppDatabase } from './db';

/** Repository-relative folder holding the SQL files and meta/_journal.json. */
export const MIGRATIONS_FOLDER = 'libs/plant-catalog-data/migrations';

/**
 * Journal timestamp of 0000_baseline, equal to the last migration it replaced
 * (0012). Drizzle skips migrations no newer than the latest one recorded, so a
 * database that recorded 0001-0012 (every v0.1.0 install) skips the baseline.
 */
export const BASELINE_MILLIS = 1720000000012;

/**
 * Apply migrations that have not run yet, each exactly once.
 *
 * Applied migrations are recorded in drizzle.__drizzle_migrations, the same
 * table `npm run migrate` (drizzle-kit) uses. Before migrating, refuse a
 * database the baseline cannot safely start from (see assertUpgradeable).
 */
export async function runMigrations(
  db: AppDatabase,
  migrationsFolder = resolve(process.cwd(), MIGRATIONS_FOLDER),
): Promise<void> {
  await assertUpgradeable(db);
  await migrate(db, { migrationsFolder });
}

/**
 * The baseline creates every table, so it must run only on an empty database.
 * Two kinds of database cannot upgrade directly; both come only from builds
 * before v0.1.0:
 * - tables but no migration records (the old run-every-file loop), and
 * - records that stop before 0012.
 * Upgrade those with v0.1.0 first, or recreate them.
 */
export async function assertUpgradeable(db: AppDatabase): Promise<void> {
  const state = await db.execute<{ tracked: boolean; has_tables: boolean }>(sql`
    select to_regclass('drizzle.__drizzle_migrations') is not null as tracked,
           to_regclass('public.users') is not null as has_tables`);
  const { tracked, has_tables: hasTables } = state.rows[0]!;
  if (!tracked) {
    if (hasTables) throw new Error(notUpgradeable('has tables but no migration records'));
    return;
  }
  const latest = await db.execute<{ last: string | null }>(
    sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`,
  );
  const last = latest.rows[0]?.last;
  if (last != null && Number(last) < BASELINE_MILLIS) {
    throw new Error(notUpgradeable('stopped part-way through the pre-0.1.0 migrations'));
  }
}

function notUpgradeable(reason: string): string {
  return (
    `This database ${reason}, so it predates Open Garden v0.1.0 and cannot upgrade directly. ` +
    'Start v0.1.0 against it once, then this version; or back it up and start with an empty database.'
  );
}
