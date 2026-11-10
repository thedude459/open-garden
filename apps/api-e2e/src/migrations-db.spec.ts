import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  BASELINE_MILLIS,
  createDb,
  MIGRATIONS_FOLDER,
  runMigrations,
} from '@open-garden/plant-catalog-data';

const databaseUrl = process.env['DATABASE_URL'];
const folder = resolve(process.cwd(), MIGRATIONS_FOLDER);
const sqlFiles = readdirSync(folder)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const created: string[] = [];
const tempDirs: string[] = [];

function urlFor(name: string): string {
  const url = new URL(databaseUrl!);
  url.pathname = `/${name}`;
  return url.toString();
}

async function admin<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: urlFor('postgres') });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** A throwaway database so these checks never touch the e2e or app data. */
async function freshDatabase(label: string): Promise<string> {
  const name = `og_migrate_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await admin((c) => c.query(`create database "${name}"`));
  created.push(name);
  return urlFor(name);
}

async function migrate(url: string, migrationsFolder = folder): Promise<void> {
  const { db, pool } = createDb(url);
  try {
    await runMigrations(db, migrationsFolder);
  } finally {
    await pool.end();
  }
}

async function query<T extends Record<string, unknown>>(url: string, text: string): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<T>(text)).rows;
  } finally {
    await client.end();
  }
}

/** Insert one bed with kind 'orchard' and full geometry; 0012 deletes such beds. */
async function insertOrchardBed(url: string): Promise<void> {
  await query(
    url,
    `with u as (insert into users (email, password_hash) values ('m@example.com', 'x') returning id),
          g as (insert into gardens (owner_id, name, name_normalized) select id, 'G', 'g' from u returning id)
     insert into garden_beds (garden_id, name, name_normalized, kind,
                              origin_x_inches, origin_y_inches, length_inches, width_inches)
     select id, 'Old orchard bed', 'old orchard bed', 'orchard', 0, 0, 96, 48 from g`,
  );
}

async function orchardBeds(url: string): Promise<number> {
  const rows = await query<{ n: string }>(
    url,
    `select count(*) as n from garden_beds where kind = 'orchard'`,
  );
  return Number(rows[0]?.n);
}

async function recorded(url: string): Promise<number> {
  const rows = await query<{ n: string }>(
    url,
    'select count(*) as n from drizzle.__drizzle_migrations',
  );
  return Number(rows[0]?.n);
}

/** The schema every release since v0.1.0 has, without migration records. */
/** Migrations added after the baseline; a v0.1.0 database has none of them yet. */
const laterMigrations = sqlFiles.filter((f) => f !== '0000_baseline.sql').length;

async function applyBaselineSql(url: string): Promise<void> {
  await query(url, readFileSync(resolve(folder, '0000_baseline.sql'), 'utf8'));
}

/** Record migrations 0001..`upTo` the way Drizzle did on a v0.1.0 install. */
async function recordOldMigrations(url: string, upTo: number): Promise<void> {
  await query(
    url,
    `create schema if not exists drizzle;
     create table if not exists drizzle.__drizzle_migrations
       (id serial primary key, hash text not null, created_at bigint)`,
  );
  for (let i = 1; i <= upTo; i++) {
    await query(
      url,
      `insert into drizzle.__drizzle_migrations (hash, created_at)
       values ('v0.1.0-${i}', ${BASELINE_MILLIS - 12 + i})`,
    );
  }
}

/** A copy of the migrations folder plus one later migration, as the next release would add. */
function foldersWithNextMigration(): string {
  const dir = mkdtempSync(join(tmpdir(), 'og-migrations-'));
  tempDirs.push(dir);
  cpSync(folder, dir, { recursive: true });
  writeFileSync(join(dir, '0001_next.sql'), 'create table next_release_probe (id integer);');
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
  };
  journal.entries.push({
    idx: journal.entries.length,
    version: '7',
    when: Date.now(),
    tag: '0001_next',
    breakpoints: true,
  });
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe.skipIf(!databaseUrl)('migrations run once per database', () => {
  afterAll(async () => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
    await admin(async (c) => {
      for (const name of created) await c.query(`drop database if exists "${name}" with (force)`);
    });
  });

  it('a fresh database gets the baseline once and a second run changes nothing', async () => {
    const url = await freshDatabase('fresh');
    await migrate(url);
    expect(await recorded(url)).toBe(sqlFiles.length);

    await insertOrchardBed(url);
    await migrate(url);
    expect(await recorded(url)).toBe(sqlFiles.length);
    // Under the old run-every-file loop, 0012 deleted this bed on every boot.
    expect(await orchardBeds(url)).toBe(1);
  });

  it('a v0.1.0 database skips the baseline, keeps its data, and takes later migrations', async () => {
    const url = await freshDatabase('v010');
    await applyBaselineSql(url);
    await recordOldMigrations(url, 12);
    await insertOrchardBed(url);

    await migrate(url);
    // The baseline is skipped; every migration added since v0.1.0 applies.
    expect(await recorded(url)).toBe(12 + laterMigrations);
    expect(await orchardBeds(url)).toBe(1);

    await migrate(url, foldersWithNextMigration());
    expect(await recorded(url)).toBe(12 + laterMigrations + 1);
    expect(await query(url, 'select * from next_release_probe')).toEqual([]);
  });

  it('refuses a database built by the old run-every-file loop, and leaves it alone', async () => {
    const url = await freshDatabase('legacy');
    await applyBaselineSql(url);
    await insertOrchardBed(url);
    await expect(migrate(url)).rejects.toThrow(/predates Open Garden v0.1.0/);
    expect(await orchardBeds(url)).toBe(1);
  });

  it('refuses a database that stopped part-way through the old migrations', async () => {
    const url = await freshDatabase('partial');
    await applyBaselineSql(url);
    await recordOldMigrations(url, 10);
    await expect(migrate(url)).rejects.toThrow(/part-way/);
    expect(await recorded(url)).toBe(10);
  });
});
