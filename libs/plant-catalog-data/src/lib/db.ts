import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface CreateDbOptions {
  /** Called when an idle pooled client fails. Defaults to console.error. */
  onPoolError?: (error: Error) => void;
  /** Shown in pg_stat_activity, so operators and tests can find these connections. */
  applicationName?: string;
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
  const pool = new Pool({ connectionString, application_name: options.applicationName });
  pool.on('error', options.onPoolError ?? logPoolError);
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export * from './schema';
