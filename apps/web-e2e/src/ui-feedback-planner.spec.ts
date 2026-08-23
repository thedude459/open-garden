import { test, expect } from '@playwright/test';
import {
  addTransplant,
  createSizedBed,
  newUser,
  openOverview,
  register,
  saveLayout,
} from './planner-helpers';

test('Save layout busy + success notice; offline Save persists until Dismiss', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/login');
  const email = `ui-save-${Date.now()}@example.com`;
  await register(page, email);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Notice garden');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Notice garden/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'North');
  const save = page.getByRole('button', { name: 'Save layout' });
  const pending = page.waitForResponse(
    (res) => res.url().includes('/layout') && res.request().method() === 'PUT',
  );
  await save.click();
  await expect(save).toHaveAttribute('aria-busy', 'true');
  expect((await pending).status()).toBe(200);
  await expect(page.getByLabel('Notification')).toContainText('Layout saved');

  await page.getByRole('button', { name: 'Edit size North' }).click();
  await page.locator('input[name="originX"]').fill('8');
  await page.context().setOffline(true);
  await save.click();
  const notice = page.getByLabel('Notification');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('role', 'alert');
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(notice).toHaveCount(0);
  await page.context().setOffline(false);
});

test('Add transplant notice; valid drop Unsaved changes; miss stays until Dismiss', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const owner = await newUser(browser, `ui-drop-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Drop garden');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Drop garden/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await expect(owner.getByLabel('Notification')).toContainText('Transplant added');
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('button', { name: 'North', exact: true }).click();
  const tray = owner.getByLabel('Planting tray');
  await tray.getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.getByRole('heading', { name: 'Bed View' }),
  );
  const miss = owner.getByLabel('Notification');
  await expect(miss).toContainText('Drop missed a bed');
  await expect(miss).toHaveAttribute('role', 'alert');
  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await expect(miss).toHaveCount(0);

  await tray.getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByText('Unsaved changes')).toBeVisible();
  await expect(owner.getByLabel('Notification')).toHaveCount(0);
});
