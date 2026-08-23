import { expect, test, type Page } from '@playwright/test';
import { createSizedBed, newUser, openOverview, saveLayout } from './planner-helpers';

async function applySearch(page: Page, name: string) {
  await page.getByLabel('Search plants').fill(name);
  const pending = page.waitForResponse(
    (res) => res.url().includes('/api/plants') && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Apply' }).click();
  await pending;
}

test('invalid catalog drops reject with a specific notice and no planting', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const owner = await newUser(browser, `planner-rej-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Reject bed');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Reject bed/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('button', { name: 'North', exact: true }).click();

  await applySearch(owner, 'Sweet Basil');
  const arm = owner.getByRole('button', { name: 'Arm Sweet Basil' });
  await expect(arm).toBeVisible();
  await arm.dragTo(owner.getByRole('heading', { name: 'Bed View' }));
  await expect(owner.getByLabel('Notification')).toContainText('Drop missed a bed');
  await expect(owner.getByRole('img', { name: 'Sweet Basil' })).toHaveCount(0);
  await expect(arm).toHaveAttribute('aria-pressed', 'false');

  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await arm.dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByRole('img', { name: 'Sweet Basil' })).toBeVisible();

  await applySearch(owner, 'Cherry Tomato');
  await owner.getByRole('button', { name: 'Arm Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByLabel('Notification')).toContainText('Too close to another plant');
  await expect(owner.getByRole('img', { name: 'Cherry Tomato' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await applySearch(owner, 'Honeycrisp Apple');
  await owner.getByRole('button', { name: 'Arm Honeycrisp Apple' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByLabel('Notification')).toContainText('Does not fit in this bed');
  await expect(owner.getByRole('img', { name: 'Honeycrisp Apple' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await applySearch(owner, 'Spinach');
  await expect(owner.getByRole('button', { name: 'Arm Spinach' })).toBeVisible();
  await owner.context().setOffline(true);
  await owner.getByRole('button', { name: 'Arm Spinach' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByLabel('Notification')).toContainText(/need to be online/i);
  await expect(owner.getByRole('img', { name: 'Spinach' })).toHaveCount(0);
});
