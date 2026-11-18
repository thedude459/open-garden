import { expect, test, type Locator } from '@playwright/test';
import { confirmFixtureAddress, openPlanting } from './planner-helpers';
import { signedInPage } from './session';

/** The browser's local date `days` from today, as the app shows it. */
function localDay(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  await fillDate(radish.locator('input[type="date"]').first(), localDay(0));
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok()),
    radish.getByRole('button', { name: 'Save planting' }).click(),
  ]);

  await radish.getByRole('button', { name: 'Repeat sowing' }).click();
  await radish.locator('input[name="everyWeeks"]').fill('1');
  await fillDate(radish.locator('input[name="repeatUntil"]'), localDay(15));
  await radish.getByRole('button', { name: 'Add sowings' }).click();
  await expect(page.getByText('Added 2 sowings of Radish (Cherry Belle).')).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'Radish (Cherry Belle)' })).toHaveCount(3);

  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  const sowTasks = page
    .locator('li.row')
    .filter({ has: page.locator('.badge', { hasText: /^Sow$/ }) });
  await expect(sowTasks).toHaveCount(2);
  await sowTasks.first().getByRole('button', { name: 'Complete' }).click();
  await expect(sowTasks).toHaveCount(1);
});
