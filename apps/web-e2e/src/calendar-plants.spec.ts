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

async function createFrostGarden(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(name);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await page.getByRole('link', { name: 'Calendar' }).click();
}

async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name })).toBeVisible();
}

test('add from favorites and catalog, filter, remove, zone mismatch, no duplicates', async ({
  browser,
}) => {
  const stamp = Date.now();
  const ownerEmail = `cal-plants-owner-${stamp}@example.com`;
  const friendEmail = `cal-plants-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Sweet Basil');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await owner.getByRole('link', { name: /Sweet Basil/ }).click();
  await owner.getByRole('button', { name: 'Save favorite' }).click();

  await createFrostGarden(owner, 'Picker bed');
  await owner.getByRole('button', { name: 'Show favorites' }).click();
  await owner.getByRole('button', { name: 'Add favorite Sweet Basil' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();

  await addFromCatalog(owner, 'Cherry Tomato');
  await addFromCatalog(owner, 'French Marigold');
  await addFromCatalog(owner, 'Papaya');
  await addFromCatalog(owner, 'Honeycrisp Apple');
  await addFromCatalog(owner, 'Cherry Tomato');
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toHaveCount(1);

  await expect(owner.locator('article').filter({ hasText: 'Papaya' }).getByText('Zone mismatch')).toBeVisible();
  await expect(
    owner.locator('article').filter({ hasText: 'Honeycrisp Apple' }).getByText('Zone mismatch'),
  ).toHaveCount(0);

  await owner.locator('select[name="plantTypeFilter"]').selectOption('vegetable');
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'French Marigold' })).toHaveCount(0);

  await owner.locator('select[name="plantTypeFilter"]').selectOption('tree');
  await expect(owner.getByText(/No plants match this type/)).toBeVisible();
  await owner.getByRole('button', { name: 'Clear filter' }).click();
  await expect(owner.locator('article').filter({ hasText: 'French Marigold' })).toBeVisible();

  await owner.getByRole('button', { name: 'Remove French Marigold' }).click();
  await expect(owner.locator('article').filter({ hasText: 'French Marigold' })).toHaveCount(0);
  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('French Marigold');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await expect(owner.getByRole('link', { name: /French Marigold/ })).toBeVisible();

  await owner.getByRole('link', { name: 'Gardens' }).click();
  await owner.getByRole('link', { name: /Picker bed/ }).click();
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Picker bed/ }).click();
  await friend.getByRole('link', { name: 'Calendar' }).click();
  await expect(friend.getByText('Sweet Basil')).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Show favorites' })).toHaveCount(0);
  await expect(friend.getByText('Your favorites')).toHaveCount(0);
});
