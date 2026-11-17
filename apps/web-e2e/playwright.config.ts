import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Every test makes its own user and property, so tests do not share rows.
  // GitHub's runners for public repositories have 4 CPUs.
  workers: 4,
  outputDir: 'test-results',
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    // A Chromium already installed on this machine instead of Playwright's
    // download (see CONTRIBUTING.md, "Running the browser tests").
    ...(process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
      ? { launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] } }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
