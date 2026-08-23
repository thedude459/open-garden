import { test, expect } from '@playwright/test';
import { waitForPipelineIdleOnPage } from './pipeline-helpers';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
}

test('admin can start a run and round-trip cadence settings', async ({ page }) => {
  await login(page, 'admin@example.com');
  const pipelineNav = page.locator('nav').getByRole('link', { name: 'Pipeline', exact: true });
  await expect(pipelineNav).toBeVisible();
  await pipelineNav.click();
  await expect(page.getByRole('heading', { name: 'Catalog pipeline' })).toBeVisible();
  await waitForPipelineIdleOnPage(page);
  await page.getByRole('button', { name: 'Start run' }).click();
  await expect(page.getByText(/Status:/)).toBeVisible();
  await expect(page.getByText(/succeeded|incomplete|failed/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.locator('select[name="cadence"]').selectOption('daily');
  await page.locator('select[name="runAtHourUtc"]').selectOption('8');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.reload();
  await expect(page.locator('select[name="cadence"]')).toHaveValue('daily');
  await expect(page.locator('select[name="runAtHourUtc"]')).toHaveValue('8');
  await page.locator('select[name="runAtHourUtc"]').selectOption('6');
  await page.getByRole('button', { name: 'Save settings' }).click();
});

test('gardener cannot open pipeline admin and has no Pipeline nav', async ({ page }) => {
  await login(page, 'gardener@example.com');
  await expect(page.locator('nav').getByRole('link', { name: 'Pipeline', exact: true })).toHaveCount(
    0,
  );
  await page.goto('/admin/pipeline');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Catalog pipeline' })).toHaveCount(0);
});
