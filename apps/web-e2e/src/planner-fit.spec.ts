import { expect, test, type Page } from '@playwright/test';
import {
  confirmFixtureAddress,
  createSizedBed,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

/** How wide the bed is drawn, as a share of the plan's width on screen. */
async function bedShare(page: Page) {
  const bed = await page.locator('[data-bed-name="North"]').boundingBox();
  const view = await page.locator('.plan-viewport').boundingBox();
  return bed!.width / view!.width;
}

test('a small bed in a large property opens filling the plan; zoom is remembered; Fit restores', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `plan-fit-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Big plot');
  await page.getByRole('spinbutton', { name: 'Length (ft)' }).fill('100');
  await page.getByRole('spinbutton', { name: 'Width (ft)' }).fill('50');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Big plot/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'North');
  await saveLayout(page);

  // An 8 ft bed is 8% of a 100 ft property; fitted, it fills most of the plan.
  await page.reload();
  await expect(page.locator('[data-bed-name="North"]')).toBeVisible();
  await expect.poll(() => bedShare(page)).toBeGreaterThan(0.4);
  const fitted = await bedShare(page);

  // Each Zoom out scales by 0.8 about the centre; wait for the redraw.
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  const zoomed = fitted * 0.8 * 0.8;
  await expect.poll(() => bedShare(page)).toBeCloseTo(zoomed, 2);

  await page.reload();
  await expect(page.locator('[data-bed-name="North"]')).toBeVisible();
  await expect.poll(() => bedShare(page)).toBeCloseTo(zoomed, 2);

  await page.getByRole('button', { name: 'Fit' }).click();
  await expect.poll(() => bedShare(page)).toBeCloseTo(fitted, 2);
});
