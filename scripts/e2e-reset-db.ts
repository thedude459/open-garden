#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for e2e reset");
  }

  if (process.env.CI === "true" && !databaseUrl.includes("garden_e2e")) {
    throw new Error("CI e2e runs must use a dedicated garden_e2e database URL");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.unsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }

  execSync("npm run db:migrate", { stdio: "inherit", env: process.env });
  console.log("E2E database reset complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
