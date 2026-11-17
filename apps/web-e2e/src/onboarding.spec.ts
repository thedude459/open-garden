import { expect, test } from '@playwright/test';
import { confirmFixtureAddress } from './planner-helpers';
import { signedInPage } from './session';

test('a first property is set up in three steps: climate, crops, a first bed', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `onboarding-${Date.now()}@example.com`);
  await page.getByPlaceholder('Property name').fill('First plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('button', { name: 'Start setup' }).click();

  await expect(page.getByRole('heading', { name: 'Set up First plot' })).toBeVisible();
  const climate = page.getByRole('region', { name: '1. Your climate' });
  await expect(climate.getByText('Hardiness zone 8.')).toBeVisible();
  await expect(climate.getByText(/Last spring frost around Apr 15/)).toBeVisible();

  const crops = page.getByRole('region', { name: '2. Pick a few crops' });
  await crops.getByRole('checkbox', { name: /^Tomato/ }).check();
  await crops.getByRole('button', { name: 'Add 1 to the calendar' }).click();
  await expect(crops.getByText('on the calendar')).toBeVisible();

  const bed = page.getByRole('region', { name: '3. Add a first bed' });
  await bed.getByRole('button', { name: 'Add bed' }).click();
  await expect(bed.getByText('Bed 1 is on the plan.')).toBeVisible();
  await bed.getByRole('link', { name: 'Open the plan' }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await expect(page.getByText('Bed 1').first()).toBeVisible();

  await page.locator('nav[aria-label="Garden"]').getByRole('link', { name: 'Calendar' }).click();
  await expect(
    page.locator('article').filter({ hasText: /^\s*(This week\s*)?Tomato\b/ }),
  ).toHaveCount(1);
});

test('a second property is not offered the guided setup', async ({ browser }) => {
  const page = await signedInPage(browser, `onboarding-second-${Date.now()}@example.com`);
  for (const name of ['One plot', 'Two plot']) {
    if (name === 'Two plot') await page.getByRole('button', { name: 'New property' }).click();
    await page.getByPlaceholder('Property name').fill(name);
    await confirmFixtureAddress(page);
    await page.getByRole('button', { name: 'Create property' }).click();
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  // The first one was offered setup; the second, not.
  await expect(page.getByRole('button', { name: 'Start setup' })).toHaveCount(0);
});
