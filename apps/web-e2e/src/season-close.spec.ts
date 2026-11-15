import { expect, test, type Page } from '@playwright/test';
import {
  confirmFixtureAddress,
  newUser,
  openConfiguration,
  openPlanting,
  openPlantingsFromGarden,
} from './planner-helpers';

async function addPlanting(page: Page, search: string, name: string) {
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill(search);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name })).toBeVisible();
}

test('closing a season carries perennials into the next and leaves last year’s annuals in its review', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `season-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Season plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Season plot/ }).click();

  await openPlantingsFromGarden(page);
  await addPlanting(page, 'Basil', 'Basil (Genovese)');
  await addPlanting(page, 'Rhubarb', 'Rhubarb (Victoria)');
  const rhubarb = page.locator('article').filter({ hasText: 'Rhubarb (Victoria)' });
  await openPlanting(rhubarb);
  await rhubarb.getByLabel('Life').selectOption('perennial');
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' &&
        /\/plantings\/[^/]+$/.test(new URL(r.url()).pathname) &&
        r.ok(),
    ),
    rhubarb.getByRole('button', { name: 'Save planting' }).click(),
  ]);

  await openConfiguration(page);
  const open = await page.getByRole('heading', { name: /^Season \d{4}$/ }).textContent();
  const year = Number(open!.replace('Season ', ''));
  await page.getByRole('button', { name: 'Close season' }).click();
  await expect(page.getByText('Season closed')).toBeVisible();
  await expect(page.getByRole('heading', { name: `Season ${year + 1}` })).toBeVisible();
  // The closed year's review lists what grew, annuals included.
  const season = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: `Season ${year + 1}` }) });
  await expect(season.getByRole('heading', { name: String(year), exact: true })).toBeVisible();
  await expect(season.locator('p').filter({ hasText: /^\s*Basil\b/ })).toBeVisible();

  // The new season keeps the perennial and drops last year's annual.
  await openPlantingsFromGarden(page);
  await expect(page.locator('article').filter({ hasText: 'Rhubarb (Victoria)' })).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'Basil (Genovese)' })).toHaveCount(0);
});
