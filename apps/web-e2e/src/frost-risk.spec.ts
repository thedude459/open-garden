import { test, expect } from '@playwright/test';
import { confirmFixtureAddress, newUser, openConfiguration } from './planner-helpers';

test('Settings show the 1-in-10 frost dates from the climate data', async ({ browser }) => {
  test.setTimeout(60_000);
  const page = await newUser(browser, `frost-risk-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Risk plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Risk plot/ }).click();
  await openConfiguration(page);
  await expect(
    page.getByText(
      /frost after May 2 comes in 1 spring in 10, and frost before Oct 5 in 1 autumn in 10/,
    ),
  ).toBeVisible();
});
