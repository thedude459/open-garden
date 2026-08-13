import { test, expect } from '@playwright/test';

test('filters narrow list', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(
    page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.locator('select[name="plantType"]').selectOption('herb');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/Sweet Basil/i)).toBeVisible();
});
