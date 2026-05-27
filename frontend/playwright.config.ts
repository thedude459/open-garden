import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const configDir = dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const storageStatePath = join(configDir, "tests", ".auth", "storageState.json");
const screenshotIgnore = process.env.CI ? ["**/ui-screenshots.spec.ts"] : [];

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global.setup.ts",
  globalTeardown: "./tests/global.teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/sign-in.spec.ts", ...screenshotIgnore],
      use: {
        ...devices["Desktop Chrome"],
        // Resolved when the browser context starts (after globalSetup writes the file).
        storageState: storageStatePath,
      },
    },
    {
      name: "signed-out",
      testMatch: "**/sign-in.spec.ts",
      retries: process.env.CI ? 2 : 1,
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
