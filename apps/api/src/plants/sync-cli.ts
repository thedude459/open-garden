import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { createDb, PlantRepository } from '@open-garden/plant-catalog-data';
import { CatalogSyncService } from '@open-garden/plant-catalog';
import { AuthService } from '@open-garden/auth';
import { createProvider } from './plants.controller';

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL required');

  // Apply SQL migrations if needed (idempotent)
  const client = new Client({ connectionString: url });
  await client.connect();
  const migrationsDir = resolve(process.cwd(), 'libs/plant-catalog-data/migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    await client.query(sql);
  }
  await client.end();

  const { db, pool } = createDb(url);
  const auth = new AuthService(db);
  await auth.ensureAdmin('admin@example.com', 'password123');
  await auth.register('gardener@example.com', 'password123', 'Gardener').catch(() => undefined);

  const provider = createProvider();
  const plants = new PlantRepository(db);
  const sync = new CatalogSyncService(db, plants, provider);
  const result = await sync.runOperatorSync(500);
  console.log(`Synced ${result.upserted} plants via ${provider.id}`);
  await pool.end();
}

void main();
