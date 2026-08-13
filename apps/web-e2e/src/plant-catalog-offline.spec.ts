import { test, expect } from '@playwright/test';

test('cached catalog readable offline', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first()).toBeVisible();
  await page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first().click();
  await expect(page.getByText(/Zones|Sun|Water/i).first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  // Dev server has no service worker; IndexedDB cache is the offline path.
  // Keep the document origin reachable and fail only plant API calls.
  await page.route('**/api/plants**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first()).toBeVisible();
});
