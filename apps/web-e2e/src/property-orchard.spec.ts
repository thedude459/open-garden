import { test, expect } from '@playwright/test';
import { confirmFixtureAddress, createSizedBed, newUser, saveLayout } from './planner-helpers';

test('a tree gets its own mulched bed and stays out of a vegetable bed search', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `orchard-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Home place');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Home place/ }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();

  await page.locator('select[name="bedMulch"]').selectOption('wood_chips');
  await page.getByRole('button', { name: 'Add tree' }).click();
  expect((await saveLayout(page)).ok()).toBeTruthy();
  await expect(page.locator('li').filter({ hasText: 'Tree' }).getByText('Wood chips')).toBeVisible();

  await createSizedBed(page, 'Veg');
  expect((await saveLayout(page)).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Open bed Veg' }).click();
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await page.getByLabel('Zone').selectOption({ label: 'Any zone' });
  await page.getByLabel('Search plants').fill('Cherry Tomato');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Place Cherry Tomato' })).toBeVisible();
  await page.getByLabel('Search plants').fill('Red Maple');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Place Red Maple' })).toHaveCount(0);
});
