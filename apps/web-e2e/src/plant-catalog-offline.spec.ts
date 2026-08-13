import { test, expect } from '@playwright/test';

test('cached catalog readable offline', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await page.getByRole('link').filter({ hasText: /./ }).first().click();
  await page.goBack();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
});
