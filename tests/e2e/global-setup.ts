import { execSync } from "node:child_process";

export default async function globalSetup() {
  execSync("tsx scripts/e2e-reset-db.ts", { stdio: "inherit", env: process.env });
  execSync("tsx scripts/e2e-seed-catalog.ts", { stdio: "inherit", env: process.env });
}
