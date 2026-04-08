const { chromium } = require('playwright');
const path = require('path');
const outDir = '/Users/matthewsavage/projects/garden-app/frontend/test-results/review2';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const log = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${m.type()}] ${m.text()}`); });

  // --- login/register ---
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outDir}/00-auth.png`, fullPage: true });

  const ts = Date.now();
  const email = `reviewer${ts}@example.com`;
  await page.getByRole('button', { name: /Sign up/i }).click().catch(() => {});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill('TestPass123!');
  const confirm = page.locator('input[type="password"]').nth(1);
  if (await confirm.count()) await confirm.fill('TestPass123!');
  await page.getByRole('button', { name: /Create account|Register|Sign up/i }).first().click();
  await page.waitForTimeout(1500);

  // login if needed
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').first().fill('TestPass123!');
    await page.getByRole('button', { name: /Sign in|Log in/i }).first().click();
    await page.waitForTimeout(1500);
  }

  // close help modal if open
  const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Close"), button:has-text("Got it"), button:has-text("Dismiss")');
  if (await closeBtn.count()) await closeBtn.first().click();

  // create garden
  const gardenInput = page.locator('input[placeholder*="garden" i], input[name="name"]').first();
  if (await gardenInput.count()) {
    await gardenInput.fill('Review QA Garden');
    const zoneInput = page.locator('input[name="zone"], input[placeholder*="zone" i]').first();
    if (await zoneInput.count()) await zoneInput.fill('10b');
    await page.getByRole('button', { name: /Create|Add garden/i }).first().click();
    await page.waitForTimeout(1000);
  }

  // close help if it re-appeared
  if (await closeBtn.count()) await closeBtn.first().click();

  const tabs = [
    'My Gardens', 'Timeline', 'Calendar', 'Seasonal Plan',
    'Bed Planner', 'AI Coach', 'Sensors', 'Crop Library', 'Pest Log'
  ];

  for (const tab of tabs) {
    const btn = page.getByRole('button', { name: tab, exact: true });
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(800);
    }
    const slug = tab.toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: `${outDir}/${slug}.png`, fullPage: true });
    console.log(`Captured ${slug}`);
  }

  require('fs').writeFileSync(`${outDir}/console.log`, log.join('\n'));
  await browser.close();
  console.log('Done. Console errors:', log.length);
})();
