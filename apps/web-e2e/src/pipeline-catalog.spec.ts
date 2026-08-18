import { test, expect } from '@playwright/test';

test.describe('pipeline catalog', () => {
  test('gardener browses local catalog with no sync control', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('gardener@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cherry Tomato/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /sync|refresh from api/i })).toHaveCount(0);
    await expect(page.getByText(/sync from api/i)).toHaveCount(0);
    await page.getByRole('link', { name: /Cherry Tomato/i }).click();
    await expect(page.getByText(/Zones|Sun|Water/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sync|refresh from api/i })).toHaveCount(0);
  });

  test('nonsense name search stays empty', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('gardener@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
    await page.getByPlaceholder('Search name / species / variety').fill('zzzxnotaplant999');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('No plants match')).toBeVisible();
  });
});
