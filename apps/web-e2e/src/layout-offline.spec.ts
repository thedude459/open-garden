import { test, expect, type Browser, type Page } from '@playwright/test';

async function register(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

async function newUser(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await register(page, email);
  return page;
}

async function saveLayout(page: Page) {
  const pending = page.waitForResponse(
    (res) => res.url().includes('/layout') && res.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save layout' }).click();
  return pending;
}

async function placePlanting(page: Page, plant: string, bed: string, x: string, y: string) {
  const before = await page.getByRole('button', { name: `Unplace ${plant}` }).count();
  const value = await page
    .locator('select[name="unplacedPlanting"] option')
    .filter({ hasText: new RegExp(`^${plant}$`) })
    .first()
    .getAttribute('value');
  expect(value).toBeTruthy();
  await page.locator('select[name="unplacedPlanting"]').selectOption(value!);
  await page.locator('select[name="placeBed"]').selectOption({ label: bed });
  await page.locator('input[name="placeX"]').fill(x);
  await page.locator('input[name="placeY"]').fill(y);
  await page.getByRole('button', { name: 'Place planting' }).click();
  await expect(page.getByRole('button', { name: `Unplace ${plant}` })).toHaveCount(before + 1);
}

async function unplaceAll(page: Page, plant: string) {
  let remaining = await page.getByRole('button', { name: `Unplace ${plant}` }).count();
  while (remaining > 0) {
    await page.getByRole('button', { name: `Unplace ${plant}` }).first().click();
    await expect(page.getByRole('button', { name: `Unplace ${plant}` })).toHaveCount(remaining - 1);
    remaining -= 1;
  }
}

test('cached layout stays readable when layout API is aborted', async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, `layout-off-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Cached layout');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Cached layout/ }).click();
  await page.getByRole('link', { name: 'Layout' }).click();
  await page.getByPlaceholder('Bed name').fill('Raised bed 1');
  await page.locator('input[name="newLength"]').fill('96');
  await page.locator('input[name="newWidth"]').fill('48');
  await page.getByRole('button', { name: 'Create bed' }).click();
  await expect(page.getByRole('button', { name: 'Raised bed 1', exact: true })).toBeVisible();
  expect((await saveLayout(page)).status()).toBe(200);
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();

  await page.route('**/api/gardens/**/layout**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();

  await page.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await page.locator('input[name="originX"]').fill('12');
  await page.getByRole('button', { name: 'Save layout' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
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
  await owner.getByRole('link', { name: 'Layout' }).click();
  await owner.getByPlaceholder('Bed name').fill('East');
  await owner.locator('input[name="newLength"]').fill('48');
  await owner.locator('input[name="newWidth"]').fill('24');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('button', { name: 'East', exact: true })).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByText('48 × 24 in · 0°')).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`layout-stale-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`layout-stale-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Stale layout/ }).click();
  await friend.getByRole('link', { name: 'Layout' }).click();
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
  await page.getByRole('link', { name: 'Plantings' }).click();
  await page.getByPlaceholder('Bed name').fill('East');
  await page.getByRole('button', { name: 'Create bed' }).click();
  await page.getByPlaceholder('Search catalog to add').fill('Cherry Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Cherry Tomato' }).click();
  await page.getByRole('button', { name: 'Add Cherry Tomato' }).click();

  await page.getByRole('link', { name: 'Back to garden' }).click();
  await page.getByRole('link', { name: 'Layout' }).click();
  const needs = page.locator('li').filter({ hasText: 'East' });
  await needs.getByPlaceholder('Length (in)').fill('96');
  await needs.getByPlaceholder('Width (in)').fill('48');
  await page.getByRole('button', { name: 'Size East' }).click();
  expect((await saveLayout(page)).status()).toBe(200);

  await placePlanting(page, 'Cherry Tomato', 'East', '24', '24');
  await placePlanting(page, 'Cherry Tomato', 'East', '60', '24');
  expect((await saveLayout(page)).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Placed', exact: true })).toBeVisible();

  await unplaceAll(page, 'Cherry Tomato');
  await placePlanting(page, 'Cherry Tomato', 'East', '20', '20');
  await placePlanting(page, 'Cherry Tomato', 'East', '30', '20');
  expect((await saveLayout(page)).status()).toBe(422);
  await expect(page.getByText('Layout has spacing or fit problems')).toBeVisible();

  await page.route('**/api/gardens/**/layout**', (route) => {
    if (route.request().method() === 'GET') return route.abort();
    return route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Placed', exact: true })).toBeVisible();
  await expect(page.getByText('Too close')).toHaveCount(0);
});
