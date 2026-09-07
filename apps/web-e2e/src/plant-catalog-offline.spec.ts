import { test, expect } from '@playwright/test';
import { signedInPage } from './session';

test('cached catalog readable offline', async ({ browser }) => {
  const page = await signedInPage(browser, `catalog-off-${Date.now()}@example.com`);
  await page.goto('/plants');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first()).toBeVisible();
  await page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first().click();
  await expect(page.getByText(/Zones|Sun|Water/i).first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  // Production / CI has no service worker; IndexedDB cache is the offline path.
  // Keep the document origin reachable and fail only plant API calls.
  await page.route('**/api/plants**', (route) => route.abort());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first()).toBeVisible();
});
