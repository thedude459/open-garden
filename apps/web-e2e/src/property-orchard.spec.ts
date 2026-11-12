import { test, expect } from '@playwright/test';
import { confirmFixtureAddress, createSizedBed, newUser, saveLayout } from './planner-helpers';

test('a tree gets its own mulched bed and stays out of a vegetable bed search', async ({
  browser,
}) => {
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
  await expect(
    page.locator('li').filter({ hasText: 'Tree' }).getByText('Wood chips'),
  ).toBeVisible();

  await createSizedBed(page, 'Veg');
  expect((await saveLayout(page)).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Open bed Veg' }).click();
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await page.getByLabel('Zone').selectOption({ label: 'Any zone' });
  await page.getByLabel('Search plants').fill('Tomato');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Place Tomato (Cherry)' })).toBeVisible();
  await page.getByLabel('Search plants').fill('Apple');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: 'Place Apple (Honeycrisp)' })).toHaveCount(0);
});

test('a bramble patch takes cane fruit and keeps vegetables out', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `bramble-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Cane place');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Cane place/ }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();

  await page.getByRole('button', { name: 'Add bramble patch' }).click();
  expect((await saveLayout(page)).ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator('[data-area-kind="bramble"]')).toHaveText('Bramble patch');
  await page.getByRole('button', { name: 'Open bed Canes' }).click();
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await page.getByLabel('Zone').selectOption({ label: 'Any zone' });
  await page.getByLabel('Search plants').fill('Raspberry');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: /^Place Raspberry/ }).first()).toBeVisible();
  await page.getByLabel('Search plants').fill('Tomato');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: /^Place Tomato/ })).toHaveCount(0);
});

test('a tree bed takes the tree’s spacing on its rootstock', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `rootstock-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Apple place');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Apple place/ }).click();
  await page.getByRole('button', { name: 'Add tree' }).click();
  expect((await saveLayout(page)).ok()).toBeTruthy();
  await expect(page.locator('li').filter({ hasText: 'Tree' }).getByText('8 × 8 ft')).toBeVisible();

  await page.getByRole('button', { name: 'Open bed Tree' }).click();
  await page.getByLabel('Rootstock').selectOption({ label: 'Standard' });
  await page.getByLabel('Zone').selectOption({ label: 'Any zone' });
  await page.getByLabel('Search plants').fill('Apple');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page
    .getByRole('button', { name: 'Place Apple (Honeycrisp)' })
    .dragTo(page.locator('[data-bed-name="Tree"]'));
  await expect(page.getByRole('img', { name: 'Apple (Honeycrisp)' })).toHaveCount(1);
  expect((await saveLayout(page)).ok()).toBeTruthy();

  // A standard apple needs about 25 ft; the planting records its rootstock.
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(
    page.locator('li').filter({ hasText: 'Tree' }).getByText('25 × 25 ft'),
  ).toBeVisible();
});
