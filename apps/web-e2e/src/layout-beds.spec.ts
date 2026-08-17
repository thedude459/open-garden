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

async function openPlantings(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(name);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.getByRole('link', { name: 'Plantings' }).click();
}

async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

async function saveLayout(page: Page) {
  const pending = page.waitForResponse(
    (res) => res.url().includes('/layout') && res.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save layout' }).click();
  const res = await pending;
  expect([200, 422]).toContain(res.status());
  return res;
}

test('layout beds: size planting-list bed, add second, rotate, confirm delete, viewer read-only', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `layout-bed-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `layout-bed-friend-${stamp}@example.com`);

  await openPlantings(owner, 'Layout plot');
  await owner.getByPlaceholder('Bed name').fill('Raised bed 1');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('heading', { name: 'Raised bed 1' })).toBeVisible();
  await addFromCatalog(owner, 'Cherry Tomato');

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Layout' }).click();
  await expect(owner.getByRole('heading', { name: 'Layout' })).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Needs size' })).toBeVisible();

  const needs = owner.locator('li').filter({ hasText: 'Raised bed 1' });
  await needs.getByPlaceholder('Length (in)').fill('96');
  await needs.getByPlaceholder('Width (in)').fill('48');
  await owner.getByRole('button', { name: 'Size Raised bed 1' }).click();
  await saveLayout(owner);
  await expect(owner.getByText('96 × 48 in · 0°')).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Needs size' })).toHaveCount(0);

  await owner.getByPlaceholder('Bed name').fill('Patio pots');
  await owner.locator('input[name="newLength"]').fill('40');
  await owner.locator('input[name="newWidth"]').fill('20');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('button', { name: 'Patio pots', exact: true })).toBeVisible();
  await saveLayout(owner);
  await expect(owner.getByText('40 × 20 in · 0°')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Raised bed 1', exact: true })).toHaveCount(1);

  await owner.reload();
  await expect(owner.getByText('96 × 48 in · 0°')).toBeVisible();
  await expect(owner.getByText('40 × 20 in · 0°')).toBeVisible();

  await owner.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await owner.getByRole('button', { name: 'Rotate 90°' }).click();
  await saveLayout(owner);
  await expect(owner.getByText('96 × 48 in · 90°')).toBeVisible();

  await owner.getByRole('button', { name: 'Delete bed Raised bed 1' }).click();
  await owner.getByRole('button', { name: 'Cancel' }).click();
  await expect(owner.getByText('96 × 48 in · 90°')).toBeVisible();

  await owner.getByRole('button', { name: 'Delete bed Raised bed 1' }).click();
  await owner.getByRole('button', { name: 'Confirm delete Raised bed 1' }).click();
  await expect(owner.getByRole('button', { name: 'Raised bed 1', exact: true })).toHaveCount(0);
  await expect(owner.getByRole('button', { name: 'Patio pots', exact: true })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.getByRole('link', { name: 'Plantings' }).click();
  await expect(owner.getByRole('heading', { name: 'Raised bed 1' })).toHaveCount(0);
  await expect(owner.getByRole('heading', { name: 'Unassigned' })).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`layout-bed-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`layout-bed-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Layout plot/ }).click();
  await friend.getByRole('link', { name: 'Layout' }).click();
  await expect(friend.getByRole('button', { name: 'Patio pots', exact: true })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Rotate/ })).toHaveCount(0);
});
