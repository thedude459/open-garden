// Test-only helper: a real PostgreSQL (PGlite, PostgreSQL compiled to
// WebAssembly) in the test process, with the project's migrations applied.
// Repository tests run anywhere — no Docker, no DATABASE_URL — and count
// toward coverage. Not exported from the library; excluded from coverage.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { drizzle } from 'drizzle-orm/pglite';
import type { AppDatabase } from './db';
import { MIGRATIONS_FOLDER } from './migrate';
import * as schema from './schema';

export interface TestDb {
  db: AppDatabase;
  /** Runs SQL with several statements, as a migration file does. */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * A fresh database with every migration applied, or only those sorting
 * before `stopBefore` (a migration file name prefix such as '0003'). Each SQL file runs through
 * PGlite's exec, which accepts several statements at once like the production
 * driver does; Drizzle's PGlite migrator prepares one statement at a time.
 */
export async function createTestDb(stopBefore?: string): Promise<TestDb> {
  const client = new PGlite({ extensions: { pgcrypto } });
  const folder = resolve(process.cwd(), MIGRATIONS_FOLDER);
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith('.sql') && (!stopBefore || f < stopBefore))
    .sort()) {
    await client.exec(readFileSync(resolve(folder, file), 'utf8'));
  }
  // The PGlite and node-postgres Drizzle databases share the query API the
  // repositories use; the types differ only in driver details.
  const db = drizzle(client, { schema }) as unknown as AppDatabase;
  return {
    db,
    exec: async (text) => {
      await client.exec(text);
    },
    close: () => client.close(),
  };
}

let sequence = 0;
const unique = (prefix: string) =>
  `${prefix}-${++sequence}-${Math.random().toString(36).slice(2, 7)}`;

export async function insertUser(db: AppDatabase, email = `${unique('user')}@example.com`) {
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash: 'x', displayName: email.split('@')[0] })
    .returning();
  return user!;
}

export function gardenInput(ownerId: string, name = unique('Garden')) {
  return {
    ownerId,
    name,
    nameNormalized: name.toLowerCase(),
    notes: null,
    hardinessZone: null,
    lastFrostMonth: null,
    lastFrostDay: null,
    firstFrostMonth: null,
    firstFrostDay: null,
    lengthInches: 240,
    widthInches: 120,
    formattedAddress: null,
    latitude: null,
    longitude: null,
    placeId: null,
  };
}

export async function insertPlant(db: AppDatabase, commonName = unique('Plant')) {
  const [plant] = await db
    .insert(schema.plants)
    .values({
      varietyKey: unique('variety'),
      commonName,
      species: 'Testus plantus',
      plantType: 'vegetable',
      zoneMin: 3,
      zoneMax: 9,
      spacingInches: 12,
      daysToMaturity: 60,
    })
    .returning();
  return plant!;
}
