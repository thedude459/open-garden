import { expect, test } from '@playwright/test';
import {
  confirmFixtureAddress,
  createSizedBed,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('a property card draws a small plan with its beds', async ({ browser }) => {
  test.setTimeout(60_000);
  const page = await newUser(browser, `cards-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Card plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  const card = page.locator('a.garden-card').filter({ hasText: 'Card plot' });
  await expect(card.locator('svg.garden-thumb')).toBeVisible();
  await expect(card.locator('.garden-thumb-bed')).toHaveCount(0);

  await card.click();
  await openOverview(page);
  await createSizedBed(page, 'North');
  await saveLayout(page);

  await page.goto('/gardens');
  await expect(card.locator('.garden-thumb-bed')).toHaveCount(1);
  await expect(card).toContainText('1 bed');
});
