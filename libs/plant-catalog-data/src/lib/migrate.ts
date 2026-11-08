import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { AppDatabase } from './db';

/** Repository-relative folder holding the SQL files and meta/_journal.json. */
export const MIGRATIONS_FOLDER = 'libs/plant-catalog-data/migrations';

/**
 * Apply migrations that have not run yet, each exactly once.
 *
 * Applied migrations are recorded in drizzle.__drizzle_migrations, the same
 * table `npm run migrate` (drizzle-kit) uses, so databases set up either way
 * agree. A database created by the old run-every-file loop has no such table:
 * the first run applies every file one last time (all are written to be
 * re-runnable) and records them, and later runs skip them.
 */
export async function runMigrations(
  db: AppDatabase,
  migrationsFolder = resolve(process.cwd(), MIGRATIONS_FOLDER),
): Promise<void> {
  await migrate(db, { migrationsFolder });
}
