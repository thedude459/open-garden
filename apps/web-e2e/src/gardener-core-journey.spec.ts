import { expect, test } from '@playwright/test';
import {
  addTransplant,
  applyPlantSearch,
  confirmFixtureAddress,
  createSizedBed,
  openOverview,
  saveLayout,
} from './planner-helpers';
import { signedInViaLoginForm, uniqueEmail } from './session';

/**
 * One linear gardener smoke: UI login → property → bed → direct seed →
 * waiting transplant → place transplant. Granular coverage of each step lives
 * in the other web-e2e specs; this file only proves the chained happy path.
 */
test('gardener journey: login, property, bed, direct seed, transplant, plant transplant', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await signedInViaLoginForm(browser, uniqueEmail('journey'));

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
