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
  await expect(page.getByRole('heading', { name: 'Plantings' })).toBeVisible();
}

async function fillDate(input: ReturnType<Page['locator']>, value: string) {
  await input.evaluate((el, next) => {
    const field = el as HTMLInputElement;
    field.value = next;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

test('record plantings, dates, confirm remove, favorites picker, viewer read-only', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const ownerEmail = `plant-rec-owner-${stamp}@example.com`;
  const friendEmail = `plant-rec-friend-${stamp}@example.com`;
  const owner = await newUser(browser, ownerEmail);
  const friend = await newUser(browser, friendEmail);

  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Sweet Basil');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await owner.getByRole('link', { name: /Sweet Basil/ }).click();
  await owner.getByRole('button', { name: 'Save favorite' }).click();

  await openPlantings(owner, 'Record bed');
  await addFromCatalog(owner, 'Cherry Tomato');
  const tomato = owner.locator('article').filter({ hasText: 'Cherry Tomato' }).first();
  await expect(tomato.getByText('Not set').first()).toBeVisible();
  const planted = tomato.locator('input[type="date"]').first();
  await expect(planted).toHaveValue('');
  const today = new Date().toISOString().slice(0, 10);
  await expect(planted).not.toHaveValue(today);

  await fillDate(planted, '2026-04-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.locator('input[type="date"]').first()).toHaveValue('2026-04-01');

  await fillDate(planted, '2026-12-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.locator('input[type="date"]').first()).toHaveValue('2026-12-01');

  await fillDate(tomato.locator('input[name^="harvested-"]'), '2026-12-15');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(tomato.locator('input[name^="harvested-"]')).toHaveValue('2026-12-15');

  await fillDate(tomato.locator('input[name^="harvested-"]'), '2026-01-01');
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await expect(owner.getByText(/Harvest date must be on or after planted date/)).toBeVisible();
  await expect(tomato.locator('input[type="date"]').first()).toHaveValue('2026-12-01');
  await expect(tomato.locator('input[type="date"]').nth(1)).toHaveValue('2026-12-15');

  await addFromCatalog(owner, 'Cherry Tomato');
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toHaveCount(2);

  await owner.getByRole('button', { name: 'Show favorites' }).click();
  await owner.getByRole('button', { name: 'Add favorite Sweet Basil' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();

  const basil = owner.locator('article').filter({ hasText: 'Sweet Basil' });
  await basil.getByRole('button', { name: 'Remove Sweet Basil' }).click();
  await basil.getByRole('button', { name: 'Cancel' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' })).toBeVisible();
  await basil.getByRole('button', { name: 'Remove Sweet Basil' }).click();
  await basil.getByRole('button', { name: 'Confirm remove' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Sweet Basil' })).toHaveCount(0);

  await owner.goto('/plants');
  await owner.getByPlaceholder('Search name / species / variety').fill('Cherry Tomato');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await expect(owner.getByRole('link', { name: /Cherry Tomato/ })).toBeVisible();
  await owner.goto('/favorites');
  await expect(owner.getByText('Sweet Basil')).toBeVisible();
  await owner.getByRole('link', { name: 'Gardens' }).click();
  await owner.getByRole('link', { name: /Record bed/ }).click();
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toHaveCount(0);

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(friendEmail);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(friendEmail)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Record bed/ }).click();
  await friend.getByRole('link', { name: 'Plantings' }).click();
  await expect(friend.locator('article').filter({ hasText: 'Cherry Tomato' }).first()).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Show favorites' })).toHaveCount(0);
  await expect(friend.getByText('Your favorites')).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Remove/ })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
});
