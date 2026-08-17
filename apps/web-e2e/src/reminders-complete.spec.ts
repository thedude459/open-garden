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

async function setupGardenWithTomato(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill(name);
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await page.getByRole('link', { name: 'Plantings' }).click();
  await page.getByPlaceholder('Search catalog to add').fill('Cherry Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Cherry Tomato' }).click();
  const tomato = page.locator('article').filter({ hasText: 'Cherry Tomato' }).first();
  await tomato.locator('input[type="date"]').first().evaluate((el) => {
    const field = el as HTMLInputElement;
    field.value = '2026-01-01';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await tomato.getByRole('button', { name: 'Save planting' }).click();
  await page.getByRole('link', { name: 'Reminders' }).click();
}

test('collaborator completes harvest; planting remains; viewer read-only', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `rem-done-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `rem-done-friend-${stamp}@example.com`);

  await setupGardenWithTomato(owner, 'Complete plot');
  await expect(owner.getByText('Harvest')).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`rem-done-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('collaborator');
  await owner.getByRole('button', { name: 'Invite' }).click();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Complete plot/ }).click();
  await friend.getByRole('link', { name: 'Reminders' }).click();
  await friend.getByRole('button', { name: 'Complete' }).click();
  await expect(friend.getByText('Harvest')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Reminders' }).click();
  await expect(owner.getByText('Harvest')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Plantings' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Cherry Tomato' })).toBeVisible();
  await expect(owner.locator('input[name^="harvested-"]').first()).toHaveValue('');
});
