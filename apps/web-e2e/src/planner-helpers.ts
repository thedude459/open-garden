import { expect, type Browser, type Page } from '@playwright/test';

export async function register(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

export async function newUser(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await register(page, email);
  return page;
}

export async function saveLayout(page: Page) {
  const pending = page.waitForResponse(
    (res) => res.url().includes('/layout') && res.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save layout' }).click();
  return pending;
}

export async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

export async function openOverview(page: Page) {
  await page.getByRole('link', { name: 'Garden Overview' }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
}

export async function createSizedBed(page: Page, name: string, length = '96', width = '48') {
  await page.getByPlaceholder('Bed name').fill(name);
  await page.locator('input[name="newLength"]').fill(length);
  await page.locator('input[name="newWidth"]').fill(width);
  await page.getByRole('button', { name: 'Create bed' }).click();
}

export async function addTransplant(page: Page, name: string, date = '2026-03-01') {
  await expect(page.getByRole('heading', { name: 'Transplant View' })).toBeVisible();
  const search = page.locator('input[name="transplantSearch"]');
  await expect(search).toBeVisible();
  await search.fill(name);
  const pending = page.waitForResponse(
    (res) => res.url().includes('/api/plants') && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await pending;
  const add = page.getByRole('button', { name: `Add transplant ${name}` });
  await expect(add).toBeVisible();
  await page.locator('li').filter({ hasText: name }).locator('input[type="date"]').fill(date);
  await add.click();
  await expect(page.getByText(new RegExp(`${name} · started`))).toBeVisible();
}

export async function inviteViewer(owner: Page, email: string) {
  if (await owner.getByRole('link', { name: 'Back to garden' }).count()) {
    await owner.getByRole('link', { name: 'Back to garden' }).click();
  } else {
    await owner.getByRole('link', { name: 'Back to overview' }).click();
    await owner.getByRole('link', { name: 'Back to garden' }).click();
  }
  await owner.locator('input[name="inviteEmail"]').fill(email);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(email)).toBeVisible();
}
