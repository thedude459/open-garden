import { expect, test, type Locator } from '@playwright/test';
import { confirmFixtureAddress, openPlanting } from './planner-helpers';
import { signedInPage } from './session';

async function fillDate(input: Locator, value: string) {
  await input.evaluate((el, next) => {
    const field = el as HTMLInputElement;
    field.value = next;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('repeating a sowing adds dated sowings that come up as Sow tasks', async ({ browser }) => {
  const page = await signedInPage(browser, `succession-${Date.now()}@example.com`);
  await page.getByPlaceholder('Property name').fill('Succession plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Succession plot/ }).click();
  await page.getByRole('link', { name: 'Plantings', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Radish');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Radish (Cherry Belle)' }).click();

  const radish = page.locator('article').filter({ hasText: 'Radish (Cherry Belle)' }).first();
  await openPlanting(radish);
  // Next spring at the test address (frost Apr 15 and Oct 20): radish sows
  // Mar 11 to Apr 29 and again Sep 8 to Oct 6, its last useful sowing.
  const y = new Date().getFullYear() + 1;
  await fillDate(radish.locator('input[type="date"]').first(), `${y}-03-11`);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok()),
    radish.getByRole('button', { name: 'Save planting' }).click(),
  ]);

  await radish.getByRole('button', { name: 'Repeat sowing' }).click();
  await expect(radish.getByText(`ripens before frost here is ${y}-10-06`)).toBeVisible();
  await expect(radish.locator('input[name="repeatUntil"]')).toHaveValue(`${y}-10-06`);
  await fillDate(radish.locator('input[name="repeatUntil"]'), `${y}-10-31`);
  await radish.getByRole('button', { name: 'Add sowings' }).click();
  await expect(
    page.getByText(
      'Added 5 sowings of Radish (Cherry Belle). Left out 9 sowings outside its sowing windows and 2 sowings too late to ripen before frost.',
    ),
  ).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'Radish (Cherry Belle)' })).toHaveCount(6);

  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  const sowTasks = page
    .locator('li.row')
    .filter({ has: page.locator('.badge', { hasText: /^Sow$/ }) });
  // The first sowing was dated ahead too, so it has a Sow task with the five.
  await expect(sowTasks).toHaveCount(6);
  await sowTasks.first().getByRole('button', { name: 'Complete' }).click();
  await expect(sowTasks).toHaveCount(5);
});
