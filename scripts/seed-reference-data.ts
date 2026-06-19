#!/usr/bin/env tsx
import { closeDb } from "../lib/db/client";
import { seedReferenceData } from "../lib/reference/seed-companions";

async function main() {
  const count = await seedReferenceData();
  console.log(`Seeded ${count} reference plants`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
