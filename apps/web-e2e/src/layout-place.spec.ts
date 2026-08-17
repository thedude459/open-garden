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

async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

async function sizeFirstBed(page: Page, name: string) {
  const needs = page.locator('li').filter({ hasText: name });
  await needs.getByPlaceholder('Length (in)').fill('96');
  await needs.getByPlaceholder('Width (in)').fill('48');
  await page.getByRole('button', { name: `Size ${name}` }).click();
  const saved = await saveLayout(page);
  expect(saved.status()).toBe(200);
  await expect(page.getByText('96 × 48 in · 0°')).toBeVisible();
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

test('place plantings, spacing/fit save gate, unplace, calendar absent, viewer cannot place', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `layout-place-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `layout-place-friend-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Place plot');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Place plot/ }).click();
  await owner.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await owner.locator('select[name="lastMonth"]').selectOption('4');
  await owner.locator('input[name="lastDay"]').fill('15');
  await owner.locator('select[name="firstMonth"]').selectOption('10');
  await owner.locator('input[name="firstDay"]').fill('20');
  await owner.getByRole('button', { name: 'Save garden' }).click();

  await owner.getByRole('link', { name: 'Calendar' }).click();
  await owner.getByPlaceholder('Search catalog to add').fill('Spinach');
  await owner.getByRole('button', { name: 'Search catalog' }).click();
  await owner.getByRole('button', { name: 'Add Spinach' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Spinach' })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Plantings' }).click();
  await owner.getByPlaceholder('Bed name').fill('Raised bed 1');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await addFromCatalog(owner, 'Cherry Tomato');
  await addFromCatalog(owner, 'Cherry Tomato');
  await addFromCatalog(owner, 'Sweet Basil');
  await addFromCatalog(owner, 'Unknown Herb');
  await addFromCatalog(owner, 'Red Maple');

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Layout' }).click();
  await expect(owner.getByText('Spinach')).toHaveCount(0);
  await sizeFirstBed(owner, 'Raised bed 1');

  await placePlanting(owner, 'Cherry Tomato', 'Raised bed 1', '20', '20');
  await placePlanting(owner, 'Cherry Tomato', 'Raised bed 1', '30', '20');
  await expect(owner.getByText('Too close')).toBeVisible();
  await owner.getByRole('button', { name: 'Save layout' }).click();
  await expect(owner.getByText('Layout has spacing or fit problems')).toBeVisible();

  await unplaceAll(owner, 'Cherry Tomato');
  await placePlanting(owner, 'Cherry Tomato', 'Raised bed 1', '20', '20');
  await placePlanting(owner, 'Cherry Tomato', 'Raised bed 1', '48', '20');
  await expect(owner.getByText('Too close')).toHaveCount(0);
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByRole('heading', { name: 'Placed', exact: true })).toBeVisible();

  await unplaceAll(owner, 'Cherry Tomato');
  await placePlanting(owner, 'Cherry Tomato', 'Raised bed 1', '20', '20');
  await placePlanting(owner, 'Sweet Basil', 'Raised bed 1', '38', '20');
  await expect(owner.getByText('Too close')).toBeVisible();
  await owner.getByRole('button', { name: 'Save layout' }).click();
  await expect(owner.getByText('Layout has spacing or fit problems')).toBeVisible();

  await owner.getByRole('button', { name: 'Unplace Sweet Basil' }).click();
  await placePlanting(owner, 'Unknown Herb', 'Raised bed 1', '21', '20');
  await expect(owner.getByText('Spacing unavailable')).toBeVisible();
  await expect(owner.getByText('Too close')).toHaveCount(0);
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByRole('button', { name: 'Unplace Unknown Herb' })).toBeVisible();

  await owner.getByRole('button', { name: 'Unplace Unknown Herb' }).click();
  expect((await saveLayout(owner)).status()).toBe(200);
  await placePlanting(owner, 'Red Maple', 'Raised bed 1', '24', '24');
  await expect(owner.getByText('Does not fit')).toBeVisible();
  await owner.getByRole('button', { name: 'Unplace Red Maple' }).click();
  await expect(owner.getByRole('button', { name: 'Unplace Red Maple' })).toHaveCount(0);
  await expect(
    owner.locator('select[name="unplacedPlanting"] option').filter({ hasText: /^Red Maple$/ }),
  ).toHaveCount(1);

  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Plantings' }).click();
  await expect(
    owner
      .locator('section')
      .filter({ has: owner.getByRole('heading', { name: 'Raised bed 1' }) })
      .locator('article')
      .filter({ hasText: 'Cherry Tomato' })
      .first(),
  ).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Unknown Herb' })).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Red Maple' })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Layout' }).click();
  await owner.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await owner.locator('input[name="length"]').fill('20');
  await owner.locator('input[name="width"]').fill('20');
  await expect(owner.getByText('Does not fit')).toBeVisible();
  await owner.getByRole('button', { name: 'Save layout' }).click();
  await expect(owner.getByText('Layout has spacing or fit problems')).toBeVisible();
  await owner.reload();
  await expect(owner.getByText('96 × 48 in · 0°')).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Placed', exact: true })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`layout-place-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`layout-place-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Place plot/ }).click();
  await friend.getByRole('link', { name: 'Layout' }).click();
  await expect(friend.getByRole('heading', { name: 'Placed', exact: true })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Place planting' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
});
