import { existsSync } from 'node:fs';
import { CatalogPipelineService } from '@open-garden/catalog-pipeline';
import {
  createDb,
  PipelineRunRepository,
  PipelineSettingsRepository,
  PlantRepository,
  PlantSourceRepository,
  runMigrations,
} from '@open-garden/plant-catalog-data';
import { AuthService } from '@open-garden/auth';
import { createPipelineSources } from '../admin/pipeline-sources';

if (existsSync('.env')) process.loadEnvFile();

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL required');
  // --seed-only: skip the catalog pipeline when plants already exist (Docker boot).
  const seedOnly = process.argv.includes('--seed-only');

  const { db, pool } = createDb(url);
  // Tracked: each migration runs once per database, never again on later boots.
  await runMigrations(db);
  const auth = new AuthService(db);
  if (process.env['SEED_DEMO_USERS'] === 'true') {
    await auth.ensureAdmin('admin@example.com', 'password123');
    await auth.register('gardener@example.com', 'password123', 'Gardener').catch(() => undefined);
  }

  const plants = new PlantRepository(db);
  if (seedOnly) {
    const existing = await plants.listSnapshots();
    if (existing.length > 0) {
      console.log('Catalog already present; skipping fixture pipeline');
      await pool.end();
      return;
    }
  }

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
