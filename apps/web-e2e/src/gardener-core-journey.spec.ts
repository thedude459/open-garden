import { expect, test, type Browser } from '@playwright/test';
import {
  addTransplant,
  applyPlantSearch,
  confirmFixtureAddress,
  createSizedBed,
  openOverview,
  saveLayout,
} from './planner-helpers';
import { TEST_PASSWORD, uniqueEmail } from './session';

const ORIGIN = 'http://localhost:4200';

/**
 * One linear gardener smoke: UI login → property → bed → direct seed →
 * waiting transplant → place transplant. Granular coverage of each step lives
 * in the other web-e2e specs; this file only proves the chained happy path.
 */
async function loginPage(browser: Browser, email: string) {
  const context = await browser.newContext({
    baseURL: ORIGIN,
    serviceWorkers: 'block',
    locale: 'en-US',
  });
  await context.route(/openstreetmap\.org\/export\/embed/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>map</title>',
    }),
  );

  const registered = await context.request.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD, displayName: 'E2E Journey' },
  });
  expect(registered.ok(), await registered.text()).toBeTruthy();
  await context.clearCookies();

  const page = await context.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  return page;
}

test('gardener journey: login, property, bed, direct seed, transplant, plant transplant', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await loginPage(browser, uniqueEmail('journey'));

  await page.getByRole('link', { name: 'Properties' }).click();
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
  await page.getByPlaceholder('Property name').fill('Journey garden');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await expect(page.getByRole('link', { name: /Journey garden/ })).toBeVisible();

  await page.getByRole('link', { name: /Journey garden/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'North');
  expect((await saveLayout(page)).status()).toBe(200);
  await expect(page.locator('[data-bed-name="North"]')).toBeVisible();

  // Create the waiting transplant first, then place it on the empty bed.
  await page
    .locator('nav[aria-label="Garden"]')
    .getByRole('link', { name: 'Transplants', exact: true })
    .click();
  await addTransplant(page, 'Tomato (Cherry)');
  await expect(page.getByText(/Tomato \(Cherry\) · started/)).toBeVisible();

  await page
    .locator('nav[aria-label="Garden"]')
    .getByRole('link', { name: 'Plan', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open bed North' }).click();
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await expect(
    page.getByLabel('Waiting transplants').getByRole('button', { name: 'Tomato (Cherry)' }),
  ).toBeVisible();
  await page
    .getByLabel('Waiting transplants')
    .getByRole('button', { name: 'Tomato (Cherry)' })
    .dragTo(page.locator('[data-bed-name="North"]'));
  await expect(page.getByRole('img', { name: 'Tomato (Cherry)' })).toBeVisible();
  await expect(
    page.getByLabel('Waiting transplants').getByRole('button', { name: 'Tomato (Cherry)' }),
  ).toHaveCount(0);

  // Direct seed beside it (not on the same drop point — spacing would reject).
  await applyPlantSearch(page, 'Basil (Genovese)');
  const bed = page.locator('[data-bed-name="North"]');
  const box = await bed.boundingBox();
  expect(box).toBeTruthy();
  await page.getByRole('button', { name: 'Place Basil (Genovese)' }).dragTo(bed, {
    targetPosition: { x: Math.round(box!.width * 0.2), y: Math.round(box!.height * 0.5) },
  });
  await expect(page.getByRole('img', { name: 'Basil (Genovese)' })).toBeVisible();
  expect((await saveLayout(page)).status()).toBe(200);
});
