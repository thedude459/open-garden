import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { createDb, PlantRepository } from '@open-garden/plant-catalog-data';
import { CatalogSyncService } from '@open-garden/plant-catalog';
import { AuthService } from '@open-garden/auth';
import { createProvider } from './plants.controller';

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL required');

  // Apply SQL migration if needed (idempotent)
  const client = new Client({ connectionString: url });
  await client.connect();
  const sql = readFileSync(
    resolve(process.cwd(), 'libs/plant-catalog-data/migrations/0001_init.sql'),
    'utf8',
  );
  await client.query(sql);
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
