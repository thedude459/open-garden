import { test, expect } from '@playwright/test';
import { newUser, openOverview } from './planner-helpers';

test('Garden Overview is one click from plantings, calendar, reminders, transplants', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `nav-ov-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Nav garden');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Nav garden/ }).click();
  await openOverview(page);

  for (const dest of ['Plantings', 'Calendar', 'Reminders', 'Transplants'] as const) {
    await page.getByRole('link', { name: dest, exact: true }).click();
    await page.locator('nav[aria-label="Garden"]').getByRole('link', { name: 'Garden Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  }
});
