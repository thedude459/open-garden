import { test, expect, type Page } from '@playwright/test';

async function register(page: Page, email: string, password = 'password123') {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

test('empty state, create, list, detail, rename, cancel vs confirm delete', async ({ page }) => {
  const email = `owner-${Date.now()}@example.com`;
  await register(page, email);
  await page.goto('/gardens');
  await expect(page.getByText(/No gardens yet/i)).toBeVisible();
  await page.getByPlaceholder('Garden name').fill('Backyard');
  await page.getByPlaceholder('Notes (optional)').fill('South fence');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByRole('link', { name: /Backyard/ })).toBeVisible();
  await page.getByRole('link', { name: /Backyard/ }).click();
  await expect(page.getByText(/You are owner/i)).toBeVisible();
  await page.locator('input[name="name"]').fill('Front yard');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await expect(page.getByRole('heading', { name: 'Front yard' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete garden' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Front yard' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete garden' }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByRole('heading', { name: 'Gardens' })).toBeVisible();
  await page.getByPlaceholder('Garden name').fill('Front yard');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByRole('link', { name: /Front yard/ })).toBeVisible();
});

test('stranger cannot see another user’s garden', async ({ browser }) => {
  const ownerPage = await (await browser.newContext()).newPage();
  const strangerPage = await (await browser.newContext()).newPage();
  const stamp = Date.now();
  await register(ownerPage, `iso-owner-${stamp}@example.com`);
  await ownerPage.goto('/gardens');
  await ownerPage.getByPlaceholder('Garden name').fill('Secret plot');
  await ownerPage.getByRole('button', { name: 'Create garden' }).click();
  await expect(ownerPage.getByRole('link', { name: /Secret plot/ })).toBeVisible();
  await register(strangerPage, `iso-stranger-${stamp}@example.com`);
  await strangerPage.goto('/gardens');
  await expect(strangerPage.getByText(/No gardens yet/i)).toBeVisible();
  await expect(strangerPage.getByRole('link', { name: /Secret plot/ })).toHaveCount(0);
});
