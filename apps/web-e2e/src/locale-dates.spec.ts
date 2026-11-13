import { test, expect } from '@playwright/test';
import { signedInPage } from './session';
import { confirmFixtureAddress } from './planner-helpers';

test('dates follow the browser’s language and region', async ({ browser }) => {
  test.setTimeout(60_000);
  const page = await signedInPage(browser, `locale-${Date.now()}@example.com`, 'de-DE');
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Beet');
  // The fixture address comes with frost on 15 April and 20 October.
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Beet/ }).click();
  await page.locator('nav[aria-label="Garden"]').getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Planting calendar' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Tomato (Cherry)' }).click();
  // Eight to six weeks before 15 April, in German: "18. Feb. – 4. März" (19th in a leap year).
  await expect(page.getByText(/Indoor 1[89]\. Feb\. – 4\. März/)).toBeVisible();
});
