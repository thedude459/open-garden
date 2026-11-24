import { existsSync } from 'node:fs';
import { createDb, runMigrations } from '@open-garden/plant-catalog-data';
import { AuthService } from '@open-garden/auth';
import { openCatalogPipeline } from '../admin/catalog-pipeline.factory';

if (existsSync('.env')) process.loadEnvFile();

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL required');

  const { db, pool } = createDb(url);
  // Tracked: each migration runs once per database, never again on later boots.
  await runMigrations(db);
  const auth = new AuthService(db);
  if (process.env['SEED_DEMO_USERS'] === 'true') {
    await auth.ensureAdmin('admin@example.com', 'password123');
    await auth.register('gardener@example.com', 'password123', 'Gardener').catch(() => undefined);
  }
  const adminEmail = process.env['ADMIN_EMAIL']?.trim();
  if (adminEmail) {
    const promoted = await auth.promoteToAdmin(adminEmail);
    console.log(
      promoted
        ? `ADMIN_EMAIL: ${adminEmail} has the admin role`
        : `ADMIN_EMAIL: no account for ${adminEmail} yet; register it, then restart the API`,
    );
  }

  const { pipeline } = openCatalogPipeline(db);
  // Every boot: a run whose catalog matches the last one writes nothing, and
  // an upgraded image imports the release it bundles.
  await pipeline.failStaleRunning();
  const result = await pipeline.runAndWait('operator');
  console.log(
    `Catalog import ${result.status}: upserted ${result.plantsUpserted} plants` +
      (result.errorMessage ? ` (${result.errorMessage})` : ''),
  );
  await pool.end();
}

void main();
