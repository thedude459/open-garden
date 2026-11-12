import { test, expect } from '@playwright/test';
import { newUser } from './planner-helpers';

test('where it rarely frosts, the calendar places crops by monthly temperature', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `frost-free-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Warm plot');
  await page.getByPlaceholder('Garden address').fill('1 Aloha Tower Drive, Honolulu, HI');
  await page.getByRole('button', { name: 'Look up address' }).click();
  await page.getByRole('button', { name: 'Create property' }).click();
  await expect(page.getByText(/rarely frosts here/)).toBeVisible();

  await page.getByRole('link', { name: /Warm plot/ }).click();
  // No "set frost dates" prompt on the plan.
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await expect(page.getByText('Set zone and frost dates')).toHaveCount(0);

  await page.locator('nav[aria-label="Garden"]').getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Planting calendar' })).toBeVisible();
  await expect(page.getByText(/windows are the months warm and cool enough/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Okra');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Okra', exact: true }).click();
  const okra = page.locator('article').filter({ hasText: 'Okra' }).first();
  await expect(okra.getByText('Sow Jan 1 – Dec 31')).toBeVisible();
});
