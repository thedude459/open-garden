import { test, expect } from '@playwright/test';
import { signedInPage } from './session';
import { confirmFixtureAddress, openConfiguration } from './planner-helpers';

test('the app stays in English in a browser set to another language', async ({ browser }) => {
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
  // Eight to six weeks before 15 April, in English although the browser is
  // German (ADR 0029): "Feb 18 – Mar 4" (19th in a leap year).
  await expect(page.getByText(/Indoor Feb 1[89] – Mar 4/)).toBeVisible();
  await openConfiguration(page);
  await expect(page.locator('select[name="lastMonth"] option[value="4"]')).toHaveText('April');
});
