#!/usr/bin/env tsx
import { closeDb } from "../lib/db/client";
import { runPlantSync } from "../lib/ingestion/sync-job";

async function main() {
  const result = await runPlantSync();
  console.log("Sync complete:", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
