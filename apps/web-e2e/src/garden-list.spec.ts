import { test, expect } from '@playwright/test';
import { signedInPage } from './session';
import { saveGarden, openConfiguration } from './planner-helpers';

test('empty state, create, list, detail, rename, cancel vs confirm delete', async ({
  browser,
}) => {
  const email = `owner-${Date.now()}@example.com`;
  const page = await signedInPage(browser, email);
  await page.goto('/gardens');
  await expect(page.getByText(/No gardens yet/i)).toBeVisible();
  await page.getByPlaceholder('Garden name').fill('Backyard');
  await page.getByPlaceholder('Notes (optional)').fill('South fence');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await expect(page.getByRole('link', { name: /Backyard/ })).toBeVisible();
  await page.getByRole('link', { name: /Backyard/ }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configuration' })).toHaveCount(0);
  await openConfiguration(page);
  await expect(page.getByText(/You are owner/i)).toBeVisible();
  await page.locator('input[name="name"]').fill('Front yard');
  await saveGarden(page);
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

test('list shows every membership past the first page of 20', async ({ browser }) => {
  const page = await signedInPage(browser, `paged-${Date.now()}@example.com`);
  for (let i = 0; i < 21; i++) {
    const res = await page.request.post('/api/gardens', {
      data: { name: `Paged garden ${String(i).padStart(2, '0')}` },
    });
    expect(res.status(), await res.text()).toBe(201);
  }
  await page.goto('/gardens');
  await expect(page.getByRole('link', { name: /Paged garden 00/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Paged garden 20/ })).toBeVisible();
});

test('stranger cannot see another user’s garden', async ({ browser }) => {
  const stamp = Date.now();
  const ownerPage = await signedInPage(browser, `iso-owner-${stamp}@example.com`);
  const strangerPage = await signedInPage(browser, `iso-stranger-${stamp}@example.com`);
  await ownerPage.goto('/gardens');
  await ownerPage.getByPlaceholder('Garden name').fill('Secret plot');
  await ownerPage.getByRole('button', { name: 'Create garden' }).click();
  await expect(ownerPage.getByRole('link', { name: /Secret plot/ })).toBeVisible();
  await strangerPage.goto('/gardens');
  await expect(strangerPage.getByText(/No gardens yet/i)).toBeVisible();
  await expect(strangerPage.getByRole('link', { name: /Secret plot/ })).toHaveCount(0);
});
