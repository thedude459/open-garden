/**
 * Playwright config for UI screenshot capture.
 *
 * Separate from the main e2e config because:
 *   - The main config uses a docker-based globalSetup that seeds a
 *     dedicated e2e user; screenshot runs should just use an existing
 *     local account (defaults to `test` / `Marcus$963`).
 *   - We only want to run the screenshot spec, not the full e2e suite.
 *
 * Usage:
 *   npx playwright test --config=playwright.screenshots.config.ts
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  testMatch: /ui-screenshots\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
