const { chromium } = require('playwright');
const outDir = '/Users/matthewsavage/projects/garden-app/frontend/test-results/review2';
require('fs').mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  const ts = Date.now();
  const user = `rev${ts}`;

  // Register
  await page.locator('button[role="tab"]').filter({ hasText: 'Create account' }).click();
  await page.waitForTimeout(300);
  await page.locator('input[type="email"]').fill(`${user}@example.com`);
  await page.locator('input[name="username"]').fill(user);
  await page.locator('input[name="password"]').fill('TestPass123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  // Dismiss help modal
  const helpClose = page.locator('button').filter({ hasText: /^(Got it|Close|Dismiss)$/ });
  if (await helpClose.count()) { await helpClose.first().click(); await page.waitForTimeout(400); }

  // Create garden - fill name and zip_code
  const gardenNameInput = page.locator('input[name="name"]');
  if (await gardenNameInput.isVisible().catch(() => false)) {
    await gardenNameInput.fill('Review Garden');
    await page.locator('input[name="zip_code"]').fill('90210').catch(() => {});
    // Find the submit button inside the form containing garden name input
    const gardenForm = page.locator('form').filter({ has: page.locator('input[name="name"]') });
    await gardenForm.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    console.log('Garden created');
  }

  // Dismiss help again
  if (await helpClose.count()) { await helpClose.first().click(); await page.waitForTimeout(400); }

  // Wait for timeline/calendar tabs to appear (they only appear after garden selected)
  await page.waitForSelector('button:text("Timeline")', { timeout: 10000 }).catch(() => console.log('Timeline btn not found'));

  const bodyFinal = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
  console.log('Final body:', bodyFinal);

  // Screenshot all tabs
  const tabs = [
    { label: 'My Gardens', slug: 'my-gardens' },
    { label: 'Timeline', slug: 'timeline' },
    { label: 'Calendar', slug: 'calendar' },
    { label: 'Seasonal Plan', slug: 'seasonal-plan' },
    { label: 'Bed Planner', slug: 'bed-planner' },
    { label: 'AI Coach', slug: 'ai-coach' },
    { label: 'Sensors', slug: 'sensors' },
    { label: 'Crop Library', slug: 'crop-library' },
    { label: 'Pest Log', slug: 'pest-log' },
  ];

  for (const { label, slug } of tabs) {
    const btn = page.locator('button').filter({ hasText: label }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(1200); }
    await page.screenshot({ path: `${outDir}/${slug}.png`, fullPage: true });
    console.log('captured', slug);
  }

  await browser.close();
  console.log('Done');
})();
