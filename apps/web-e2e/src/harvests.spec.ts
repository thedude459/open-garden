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

test('harvests logged on a planting and on a Harvest task add up by crop', async ({ browser }) => {
  const page = await signedInPage(browser, `harvests-${Date.now()}@example.com`);
  await page.getByPlaceholder('Property name').fill('Harvest plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Harvest plot/ }).click();
  await page.getByRole('link', { name: 'Plantings', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Tomato (Cherry)' }).click();

  // Planted this spring, so its Harvest task is due by now.
  const y = new Date().getFullYear();
  const tomato = page.locator('article').filter({ hasText: 'Tomato (Cherry)' }).first();
  await openPlanting(tomato);
  await fillDate(tomato.locator('input[type="date"]').first(), `${y}-03-01`);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PATCH' && r.ok()),
    tomato.getByRole('button', { name: 'Save planting' }).click(),
  ]);

  await fillDate(tomato.locator('input[name="harvestOn"]'), `${y}-06-01`);
  await tomato.locator('input[name="harvestWeight"]').fill('2');
  await tomato.getByRole('button', { name: 'Log harvest' }).click();
  await expect(page.getByText('Harvest of Tomato (Cherry) saved.')).toBeVisible();
  await expect(tomato.getByText('Total: 2 lb')).toBeVisible();

  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  const harvestTask = page
    .locator('li.row')
    .filter({ has: page.locator('.badge', { hasText: /^Harvest$/ }) });
  await harvestTask.locator('input[name^="count-"]').fill('5');
  await harvestTask.getByRole('button', { name: 'Complete' }).click();
  await expect(harvestTask).toHaveCount(0);

  await page.goto(page.url().replace(/reminders$/, 'harvests'));
  await expect(page.getByRole('heading', { name: 'Harvests' })).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: 'Tomato' })).toContainText(
    '2 lb and 5 picked',
  );
});
