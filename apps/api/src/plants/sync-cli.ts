import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { CatalogPipelineService } from '@open-garden/catalog-pipeline';
import {
  createDb,
  PipelineRunRepository,
  PipelineSettingsRepository,
  PlantRepository,
  PlantSourceRepository,
} from '@open-garden/plant-catalog-data';
import { AuthService } from '@open-garden/auth';
import { createPipelineSources } from '../admin/pipeline-sources';

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL required');

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

  const plants = new PlantRepository(db);
  const plantSources = new PlantSourceRepository(db);
  const runs = new PipelineRunRepository(db);
  const settings = new PipelineSettingsRepository(db);
  const pipeline = new CatalogPipelineService(
    runs,
    settings,
    {
      listSnapshots: () => plants.listSnapshots(),
      listSourceLinks: () => plantSources.listAll(),
    },
    createPipelineSources(),
  );
  const result = await pipeline.runAndWait('operator');
  console.log(`Pipeline ${result.status}: upserted ${result.plantsUpserted} plants`);
  await pool.end();
}

void main();
