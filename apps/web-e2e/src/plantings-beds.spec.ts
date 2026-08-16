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

test('named beds group, filter, rename, delete unassigns, viewer cannot manage', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const ownerEmail = `plant-bed-owner-${stamp}@example.com`;
  const friendEmail = `plant-bed-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await openPlantings(owner, 'Bed plot');
  await owner.getByPlaceholder('Bed name').fill('Raised bed 1');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('heading', { name: 'Raised bed 1' })).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Unassigned' })).toHaveCount(0);

  await addFromCatalog(owner, 'Cherry Tomato');
  await addFromCatalog(owner, 'Sweet Basil');
  const tomato = owner.locator('article').filter({ hasText: 'Cherry Tomato' }).first();
  await tomato.locator('select').selectOption({ label: 'Raised bed 1' });
  await tomato.getByRole('button', { name: 'Save planting' }).click();

  await expect(owner.getByRole('heading', { name: 'Raised bed 1' })).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Unassigned' })).toBeVisible();
  await expect(
    owner.locator('section').filter({ has: owner.getByRole('heading', { name: 'Raised bed 1' }) }).locator('article'),
  ).toHaveCount(1);
  await expect(
    owner.locator('section').filter({ has: owner.getByRole('heading', { name: 'Unassigned' }) }).locator('article'),
  ).toHaveCount(1);

  await owner.getByPlaceholder('Bed name').fill('Patio pots');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('heading', { name: 'Patio pots' })).toBeVisible();
  await expect(
    owner.locator('section').filter({ has: owner.getByRole('heading', { name: 'Patio pots' }) }).getByText('No plantings in this bed.'),
  ).toBeVisible();

  const basil = owner.locator('article').filter({ hasText: 'Sweet Basil' });
  await basil.locator('select').selectOption({ label: 'Patio pots' });
  await basil.getByRole('button', { name: 'Save planting' }).click();
  await expect(owner.getByRole('heading', { name: 'Unassigned' })).toHaveCount(0);

  await owner.locator('select[name="bedFilter"]').selectOption({ label: 'Raised bed 1' });
  await expect(owner.getByRole('heading', { name: 'Raised bed 1' })).toBeVisible();
  await expect(owner.getByRole('heading', { name: 'Patio pots' })).toHaveCount(0);
  await owner.getByRole('button', { name: 'Show all' }).click();
  await expect(owner.getByRole('heading', { name: 'Patio pots' })).toBeVisible();

  await owner.locator('select[name="bedFilter"]').selectOption({ label: 'Unassigned' });
  await expect(owner.getByText(/No plantings match this bed filter/)).toBeVisible();
  await owner.getByRole('button', { name: 'Show all' }).click();

  await owner
    .locator('form')
    .filter({ has: owner.getByRole('button', { name: 'Rename Raised bed 1' }) })
    .locator('input')
    .fill('North bed');
  await owner.getByRole('button', { name: 'Rename Raised bed 1' }).click();
  await expect(owner.getByRole('heading', { name: 'North bed' })).toBeVisible();
  await expect(
    owner.locator('section').filter({ has: owner.getByRole('heading', { name: 'North bed' }) }).locator('article').filter({ hasText: 'Cherry Tomato' }),
  ).toBeVisible();

  await owner.getByRole('button', { name: 'Delete bed North bed' }).click();
  await expect(owner.getByRole('heading', { name: 'North bed' })).toHaveCount(0);
  await expect(owner.getByRole('heading', { name: 'Unassigned' })).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Bed plot/ }).click();
  await friend.getByRole('link', { name: 'Plantings' }).click();
  await expect(friend.getByRole('heading', { name: 'Patio pots' })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Rename/ })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Delete bed/ })).toHaveCount(0);
});
