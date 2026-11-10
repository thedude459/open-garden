// The guard that keeps the baseline migration off databases it cannot start
// from. The full upgrade paths run against Postgres in
// apps/api-e2e/src/migrations-db.spec.ts.
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppDatabase } from './db';
import { assertUpgradeable, BASELINE_MILLIS } from './migrate';
import { createTestDb, type TestDb } from './test-db';

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const t of open.splice(0)) await t.close();
});

async function withSchema(): Promise<TestDb> {
  const t = await createTestDb();
  open.push(t);
  return t;
}

async function record(db: AppDatabase, createdAt: number): Promise<void> {
  await db.execute(sql`create schema if not exists drizzle`);
  await db.execute(sql`create table if not exists drizzle.__drizzle_migrations
    (id serial primary key, hash text not null, created_at bigint)`);
  await db.execute(
    sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('h', ${createdAt})`,
  );
}

describe('assertUpgradeable', () => {
  it('accepts an empty database', async () => {
    const client = new PGlite();
    open.push(client);
    await expect(assertUpgradeable(drizzle(client) as unknown as AppDatabase)).resolves.toBe(
      undefined,
    );
  });

  it('accepts a database that recorded the migrations up to the baseline', async () => {
    const { db } = await withSchema();
    await record(db, BASELINE_MILLIS);
    await expect(assertUpgradeable(db)).resolves.toBe(undefined);
  });

  it('refuses tables with no migration records', async () => {
    const { db } = await withSchema();
    await expect(assertUpgradeable(db)).rejects.toThrow(/has tables but no migration records/);
  });

  it('refuses records that stop before the baseline', async () => {
    const { db } = await withSchema();
    await record(db, BASELINE_MILLIS - 2);
    await expect(assertUpgradeable(db)).rejects.toThrow(/part-way/);
  });
});
