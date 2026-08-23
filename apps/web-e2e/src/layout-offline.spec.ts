import { test, expect } from '@playwright/test';
import { addTransplant, createSizedBed, newUser, openOverview, register, saveLayout } from './planner-helpers';

test('cached layout stays readable when layout API is aborted', async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, `layout-off-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Cached layout');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Cached layout/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'Raised bed 1');
  expect((await saveLayout(page)).status()).toBe(200);
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();

  await page.route('**/api/gardens/**/layout**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();

  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Edit size Raised bed 1' }).click();
  await page.locator('input[name="originX"]').fill('12');
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Unsaved changes')).toHaveCount(0);

  await page.getByPlaceholder('Bed name').fill('Offline bed');
  await page.getByRole('button', { name: 'Create bed' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Offline bed', exact: true })).toHaveCount(0);
  await page.context().setOffline(false);
});

test('viewer offline reads cache; removed member drops stale layout cache', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `layout-stale-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `layout-stale-friend-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Stale layout');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Stale layout/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'East', '48', '24');
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByText('48 × 24 in · 0°')).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`layout-stale-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`layout-stale-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Stale layout/ }).click();
  await openOverview(friend);
  await expect(friend.getByText('48 × 24 in · 0°')).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
  const layoutUrl = friend.url();

  await friend.route('**/api/gardens/**/layout**', (route) => route.abort());
  await friend.reload({ waitUntil: 'domcontentloaded' });
  await expect(friend.getByText('48 × 24 in · 0°')).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save layout' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Remove' }).click();
  await expect(owner.getByText(`layout-stale-friend-${stamp}@example.com`)).toHaveCount(0);

  await friend.unroute('**/api/gardens/**/layout**');
  await friend.goto(layoutUrl);
  await expect(friend.getByText(/Garden unavailable or not found/i)).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
});

test('422 PUT does not overwrite the last valid layout cache', async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, `layout-422-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Gate cache');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Gate cache/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'East');
  expect((await saveLayout(page)).status()).toBe(200);

  await page.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(page, 'Cherry Tomato');
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await page.getByRole('button', { name: 'East', exact: true }).click();
  await page.getByLabel('Planting tray').getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    page.locator('[data-bed-name="East"]'),
  );
  expect((await saveLayout(page)).status()).toBe(200);

  await page.getByRole('link', { name: 'Back to overview' }).click();
  await page.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(page, 'Sweet Basil');
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await page.getByRole('button', { name: 'East', exact: true }).click();
  await page.getByLabel('Planting tray').getByRole('button', { name: 'Sweet Basil' }).dragTo(
    page.locator('[data-bed-name="East"]'),
  );
  await page.getByRole('button', { name: 'Save layout' }).click();
  await expect(page.getByText('Layout has spacing or fit problems')).toBeVisible();

  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await page.route('**/api/gardens/**/layout**', (route) => {
    if (route.request().method() === 'GET') return route.abort();
    return route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();
  await expect(page.getByText('Too close')).toHaveCount(0);
});

test('offline Overview/Bed/Transplant mutations stay unchanged', async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, `layout-off-mutate-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Offline mutate');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Offline mutate/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'East');
  expect((await saveLayout(page)).status()).toBe(200);

  await page.context().setOffline(true);
  await page.getByPlaceholder('Bed name').fill('Offline bed');
  await page.locator('input[name="newLength"]').fill('40');
  await page.locator('input[name="newWidth"]').fill('20');
  await page.getByRole('button', { name: 'Create bed' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Offline bed', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Edit size East' }).click();
  await page.getByRole('button', { name: 'Delete bed East' }).click();
  await page.getByRole('button', { name: 'Confirm delete East' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'East', exact: true })).toHaveCount(1);

  await page.context().setOffline(false);
  await page.getByRole('link', { name: 'Transplants' }).click();
  await expect(page.getByRole('heading', { name: 'Transplant View' })).toBeVisible();
  await page.context().setOffline(true);
  await page.locator('input[name="transplantSearch"]').fill('Cherry Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
  await page.context().setOffline(false);
});
