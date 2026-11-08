import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { createDb, MIGRATIONS_FOLDER, runMigrations } from '@open-garden/plant-catalog-data';

const databaseUrl = process.env['DATABASE_URL'];
const folder = resolve(process.cwd(), MIGRATIONS_FOLDER);
const sqlFiles = readdirSync(folder).filter((f) => f.endsWith('.sql')).sort();
const created: string[] = [];

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

async function migrate(url: string): Promise<void> {
  const { db, pool } = createDb(url);
  try {
    await runMigrations(db);
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
  const rows = await query<{ n: string }>(url, `select count(*) as n from garden_beds where kind = 'orchard'`);
  return Number(rows[0]?.n);
}

async function recorded(url: string): Promise<number> {
  const rows = await query<{ n: string }>(url, 'select count(*) as n from drizzle.__drizzle_migrations');
  return Number(rows[0]?.n);
}

describe.skipIf(!databaseUrl)('migrations run once per database', () => {
  afterAll(async () => {
    await admin(async (c) => {
      for (const name of created) await c.query(`drop database if exists "${name}" with (force)`);
    });
  });

  it('records every migration on a fresh database and a second run changes nothing', async () => {
    const url = await freshDatabase('fresh');
    await migrate(url);
    expect(await recorded(url)).toBe(sqlFiles.length);

    await insertOrchardBed(url);
    await migrate(url);
    expect(await recorded(url)).toBe(sqlFiles.length);
    // Under the old run-every-file loop, 0012 deleted this bed on every boot.
    expect(await orchardBeds(url)).toBe(1);
  });

  it('adopts a database built by the old loop: one catch-up run, then nothing re-runs', async () => {
    const url = await freshDatabase('legacy');
    // What the old sync-cli did on every boot: run each file, record nothing.
    for (const file of sqlFiles) {
      await query(url, readFileSync(resolve(folder, file), 'utf8'));
    }

    await migrate(url);
    expect(await recorded(url)).toBe(sqlFiles.length);

    await insertOrchardBed(url);
    await migrate(url);
    expect(await orchardBeds(url)).toBe(1);
  });
});
