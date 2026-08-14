import { test, expect, type Page } from '@playwright/test';

async function register(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

test('cached garden list and detail stay readable when the API is unreachable', async ({ page }) => {
  await register(page, `off-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Cached bed');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByRole('link', { name: /Cached bed/ })).toBeVisible();
  await page.getByRole('link', { name: /Cached bed/ }).click();
  await expect(page.getByRole('heading', { name: 'Cached bed' })).toBeVisible();
  await page.goto('/gardens');
  await expect(page.getByRole('link', { name: /Cached bed/ })).toBeVisible();
  await page.route('**/api/gardens**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Gardens' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cached bed/ })).toBeVisible();
  await page.getByPlaceholder('Garden name').fill('Offline fail');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByText(/need to be online/i)).toBeVisible({ timeout: 5000 });
});
