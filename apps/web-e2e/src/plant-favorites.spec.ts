import { test, expect } from '@playwright/test';
import { signedInPage } from './session';

test('favorites add and remove', async ({ browser }) => {
  const page = await signedInPage(browser, `fav-${Date.now()}@example.com`);
  await page.goto('/plants');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(
    page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first().click();
  await page.getByRole('button', { name: /favorite/i }).click();
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
});
