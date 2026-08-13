import { test, expect, type Page } from '@playwright/test';

async function register(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

test('sharing a garden does not share favorites; catalog stays available', async ({ browser }) => {
  const stamp = Date.now();
  const owner = await (await browser.newContext()).newPage();
  const friend = await (await browser.newContext()).newPage();
  await register(owner, `fav-owner-${stamp}@example.com`);
  await register(friend, `fav-friend-${stamp}@example.com`);

  await expect(owner.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first()).toBeVisible({
    timeout: 15_000,
  });
  await owner.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first().click();
  await owner.getByRole('button', { name: /favorite/i }).click();
  await owner.goto('/favorites');
  await expect(owner.getByRole('heading', { name: 'Favorites' })).toBeVisible();
  await expect(owner.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i })).toBeVisible();

  await friend.goto('/favorites');
  await expect(friend.getByText(/No favorites yet/i)).toBeVisible();
  await friend.goto('/plants');
  await expect(
    friend.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first(),
  ).toBeVisible();
});
