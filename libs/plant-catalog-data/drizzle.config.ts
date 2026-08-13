import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './libs/plant-catalog-data/src/lib/schema.ts',
  out: './libs/plant-catalog-data/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://open_garden:open_garden@localhost:5432/open_garden',
  },
});
