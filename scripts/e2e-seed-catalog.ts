#!/usr/bin/env tsx
import { closeDb } from "../lib/db/client";
import { seedReferenceData } from "../lib/reference/seed-companions";
import { seedPlannerAssets } from "../lib/planner/seed-assets";

async function main() {
  const plantCount = await seedReferenceData();
  const assets = await seedPlannerAssets();
  console.log(
    `E2E seed: ${plantCount} reference plants; planner assets: ${assets.categories} categories, ${assets.plantIllustrations} illustrations`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
