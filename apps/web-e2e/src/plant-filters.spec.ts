import { test, expect } from '@playwright/test';
import { signedInPage } from './session';

test('filters narrow list', async ({ browser }) => {
  const page = await signedInPage(browser, `filters-${Date.now()}@example.com`);
  await page.goto('/plants');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(
    page.getByRole('link').filter({ hasText: /Tomato|Basil|Maple/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.locator('select[name="plantType"]').selectOption('herb');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/Sweet Basil/i)).toBeVisible();
});
