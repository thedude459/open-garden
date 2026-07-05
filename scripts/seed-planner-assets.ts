#!/usr/bin/env tsx
import { closeDb } from "../lib/db/client";
import { seedPlannerAssets } from "../lib/planner/seed-assets";

async function main() {
  const result = await seedPlannerAssets();
  console.log(
    `Seeded planner assets: ${result.categories} categories, ${result.structures} structures, ${result.templates} templates, ${result.plantIllustrations} plant mappings`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
