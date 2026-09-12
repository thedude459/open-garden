import { expect, type Page } from '@playwright/test';
import { signedInPage } from './session';

export { signedInContext, signedInPage, uniqueEmail } from './session';

/** API register + cookie. Does not open `/login`. */
export async function newUser(browser: Parameters<typeof signedInPage>[0], email: string) {
  return signedInPage(browser, email);
}

/** Walk the registration screen. Auth-screen checks only. */
export async function registerViaUi(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Need an account?' }).click();
  await page.getByPlaceholder('Display name').fill('E2E');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Gardens' })).toBeVisible();
}

export async function saveLayout(page: Page) {
  const pending = page.waitForResponse(
    (res) => res.url().includes('/layout') && res.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save layout' }).click();
  return pending;
}

/** Wait for the garden PATCH to finish before navigating away. */
export async function saveGarden(page: Page) {
  const pending = page.waitForResponse((res) => {
    const path = new URL(res.url()).pathname;
    return res.request().method() === 'PATCH' && /\/api\/gardens\/[^/]+$/.test(path);
  });
  await page.getByRole('button', { name: 'Save garden' }).click();
  expect((await pending).ok()).toBeTruthy();
}

export async function addFromCatalog(page: Page, name: string) {
  await page.getByPlaceholder('Search catalog to add').fill(name);
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.locator('article').filter({ hasText: name }).first()).toBeVisible();
}

export async function applyPlantSearch(page: Page, name: string) {
  await page.getByLabel('Search plants').fill(name);
  await page.getByRole('button', { name: 'Apply' }).click();
}

export async function openPlantingsFromGarden(page: Page) {
  await page
    .locator('nav[aria-label="Garden"]')
    .getByRole('link', { name: 'Plantings', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Plantings' })).toBeVisible();
}

export async function openOverview(page: Page) {
  await page
    .locator('nav[aria-label="Garden"]')
    .getByRole('link', { name: 'Garden Overview', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
}

export async function openConfiguration(page: Page) {
  await page.waitForURL(/\/gardens\/[^/?#]+/);
  await page
    .locator('nav[aria-label="Garden"]')
    .getByRole('link', { name: 'Configuration', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();
}

export async function inviteViewer(owner: Page, email: string) {
  await openConfiguration(owner);
  await owner.locator('input[name="inviteEmail"]').fill(email);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(email)).toBeVisible();
}

export async function createSizedBed(page: Page, name: string, length = '8', width = '4') {
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
  await page.getByRole('button', { name: 'Search catalog' }).click();
  const add = page.getByRole('button', { name: `Add transplant ${name}` });
  await expect(add).toBeVisible();
  await page.locator('li').filter({ hasText: name }).locator('input[type="date"]').fill(date);
  await add.click();
  await expect(page.getByText(new RegExp(`${name} · started`))).toBeVisible();
}
