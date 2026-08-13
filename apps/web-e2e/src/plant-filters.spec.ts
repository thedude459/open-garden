import { test, expect } from '@playwright/test';

test('filters narrow list', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.locator('select[name="plantType"]').selectOption('herb');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/basil/i)).toBeVisible();
});
