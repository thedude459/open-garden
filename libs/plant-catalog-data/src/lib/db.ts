import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * The database, or a transaction on it: Drizzle's transaction extends the same
 * base, so a repository built on either reads and writes the same way.
 */
export type AppDatabase = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export interface CreateDbOptions {
  /** Called when an idle pooled client fails. Defaults to console.error. */
  onPoolError?: (error: Error) => void;
  /** Shown in pg_stat_activity, so operators and tests can find these connections. */
  applicationName?: string;
  /**
   * Cancels a statement that runs longer than this many milliseconds, so a
   * stuck query cannot hold a connection forever. Unset for migrations and
   * imports, which may run long.
   */
  statementTimeoutMs?: number;
}

const logPoolError = (error: Error): void => {
  console.error(`Postgres pool: idle client error, client discarded: ${error.message}`);
};

/**
 * An idle client that loses its connection (database restart, network drop)
 * makes the pool emit 'error'. Without a listener Node treats that as an
 * unhandled 'error' event and exits the process. pg already removes the broken
 * client; the next query opens a fresh connection.
 */
export function createDb(
  connectionString: string,
  options: CreateDbOptions = {},
): { db: AppDatabase; pool: Pool } {
  const pool = new Pool({
    connectionString,
    application_name: options.applicationName,
    statement_timeout: options.statementTimeoutMs,
  });
  pool.on('error', options.onPoolError ?? logPoolError);
  const db = drizzle(pool, { schema });
  return { db, pool };
}

/**
 * A `Transaction` port over this database: `repos` builds the repositories
 * on the transaction, and a throw from the work rolls every write back.
 */
export function transactionOn<Repos>(
  db: AppDatabase,
  repos: (tx: AppDatabase) => Repos,
): <T>(work: (repos: Repos) => Promise<T>) => Promise<T> {
  return (work) => db.transaction((tx) => work(repos(tx)));
}

/** True when a query failed on a unique constraint (Postgres 23505), directly or wrapped by Drizzle. */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}

export * from './schema';
