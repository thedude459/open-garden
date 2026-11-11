import { test, expect } from '@playwright/test';
import { waitForPipelineIdleOnPage } from './pipeline-helpers';
import { signedInPage } from './session';

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('admin@example.com');
  await page.getByPlaceholder('Password').fill('password123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
}

test('admin can start a catalog import and see the dataset source', async ({ page }) => {
  await loginAdmin(page);
  const pipelineNav = page.locator('nav').getByRole('link', { name: 'Pipeline', exact: true });
  await expect(pipelineNav).toBeVisible();
  await pipelineNav.click();
  await expect(page.getByRole('heading', { name: 'Catalog pipeline' })).toBeVisible();
  await expect(page.getByText(/bundled with this version of Open Garden/)).toBeVisible();
  await waitForPipelineIdleOnPage(page);
  await page.getByRole('button', { name: 'Start run' }).click();
  await expect(page.getByText(/Status:/)).toBeVisible();
  await expect(page.getByText(/Status: (succeeded|incomplete|failed)/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/dataset: succeeded/)).toBeVisible();
});

test('gardener cannot open pipeline admin and has no Pipeline nav', async ({ browser }) => {
  const page = await signedInPage(browser, `pipe-gardener-${Date.now()}@example.com`);
  await page.goto('/plants');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(
    page.locator('nav').getByRole('link', { name: 'Pipeline', exact: true }),
  ).toHaveCount(0);
  await page.goto('/admin/pipeline');
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Catalog pipeline' })).toHaveCount(0);
});
