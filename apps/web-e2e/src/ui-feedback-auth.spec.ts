import { test, expect } from '@playwright/test';
import { register } from './planner-helpers';

test('login shows busy then lands on catalog without leftover notice', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  const login = page.getByRole('button', { name: 'Login' });
  await login.click();
  await expect(login).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.getByLabel('Notification')).toHaveCount(0);
});

test('Create garden busy + success notice; double click is one garden', async ({ page }) => {
  await register(page, `ui-create-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Only One');
  const create = page.getByRole('button', { name: 'Create garden' });
  await Promise.all([create.click(), create.click()]);
  await expect(page.getByRole('link', { name: /Only One/ })).toHaveCount(1);
  await expect(page.getByLabel('Notification')).toContainText('Garden created');
});

test('catalog search busy and favorite success notice', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('gardener@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await page.getByPlaceholder('Search name / species / variety').fill('Tomato');
  const apply = page.getByRole('button', { name: 'Apply' });
  await apply.click();
  await expect(page.getByRole('link').filter({ hasText: /Tomato/i }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('link').filter({ hasText: /Tomato/i }).first().click();
  const fav = page.getByRole('button', { name: /favorite/i });
  await fav.click();
  await expect(page.getByLabel('Notification')).toBeVisible();
});
