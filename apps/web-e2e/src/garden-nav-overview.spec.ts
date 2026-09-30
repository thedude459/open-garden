import { test, expect } from '@playwright/test';
import { newUser, openOverview } from './planner-helpers';

test('Garden Overview is one click from plantings, calendar, reminders, transplants', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `nav-ov-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Nav garden');
  await page.getByRole('spinbutton', { name: 'Length (ft)' }).fill('30');
  await page.getByRole('spinbutton', { name: 'Width (ft)' }).fill('15');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Nav garden/ }).click();
  await openOverview(page);
  await expect(page.locator('.layout-plan')).toHaveAttribute('viewBox', '0 0 360 180');

  for (const dest of ['Plantings', 'Calendar', 'Reminders', 'Transplants', 'Configuration'] as const) {
    await page.getByRole('link', { name: dest, exact: true }).click();
    await page.locator('nav[aria-label="Garden"]').getByRole('link', { name: 'Garden Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  }

  await page.getByRole('link', { name: 'Gardens', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gardens' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Garden"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Catalog' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Garden"]')).toHaveCount(0);
});
