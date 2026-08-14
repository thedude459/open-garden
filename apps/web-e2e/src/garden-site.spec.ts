import { test, expect, type Page } from '@playwright/test';

async function register(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

test('site profile persists, can clear one frost, and rejects reversed pairs', async ({ page }) => {
  await register(page, `site-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Zone seven');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Zone seven/ }).click();
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 7');
  await page.reload();
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 7');
  await page.locator('select[name="firstMonth"]').selectOption({ label: 'Month' });
  await page.locator('input[name="firstDay"]').fill('');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await expect(page.getByRole('group', { name: /First frost/i }).getByText(/Not set/i)).toBeVisible();
  await page.locator('select[name="lastMonth"]').selectOption('10');
  await page.locator('input[name="lastDay"]').fill('20');
  await page.locator('select[name="firstMonth"]').selectOption('4');
  await page.locator('input[name="firstDay"]').fill('15');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await expect(page.getByText(/last frost must be earlier/i)).toBeVisible();
});
