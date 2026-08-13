import { test, expect } from '@playwright/test';

test('favorites add and remove', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link').filter({ hasText: /./ }).first().click();
  await page.getByRole('button', { name: /favorite/i }).click();
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
});
