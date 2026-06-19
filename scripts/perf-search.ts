#!/usr/bin/env tsx
import { performance } from "node:perf_hooks";
import { closeDb } from "../lib/db/client";
import { searchPlants } from "../lib/catalog/search";

async function main() {
  const start = performance.now();
  await searchPlants({ userId: "00000000-0000-0000-0000-000000000000", q: "tomato" });
  const elapsed = performance.now() - start;
  console.log(`Search completed in ${elapsed.toFixed(0)}ms`);
  if (elapsed > 2000) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
