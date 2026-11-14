import { test, expect } from '@playwright/test';
import { signedInPage } from './session';

test.describe('plant catalog', () => {
  test('browse, open detail, no sync control', async ({ browser }) => {
    const page = await signedInPage(browser, `catalog-${Date.now()}@example.com`);
    await page.goto('/plants');
    await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
    // The catalog is more than one page; search rather than rely on the first.
    await page.getByPlaceholder('Search name / species / variety').fill('Tomato');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('link', { name: /Tomato \(Cherry\)/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /sync|refresh from api/i })).toHaveCount(0);
    await expect(page.getByText(/sync from api/i)).toHaveCount(0);
    await page.getByRole('link', { name: /Tomato \(Cherry\)/i }).click();
    await expect(page.getByText(/Zones|Sun|Water/i).first()).toBeVisible();
    await expect(page.getByText('Soil pH')).toBeVisible();
    await expect(page.getByText('6.0–7.0')).toBeVisible();
    // Cherry tomato carries the tomato's FAO-56 crop coefficients.
    await expect(
      page.getByText(/0\.60 young, 1\.15 at full growth,\s+0\.80 at harvest/),
    ).toBeVisible();
    await expect(
      page.getByText(/35 days young, 40 growing, 50 at full growth,\s+30 ripening/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /sync|refresh from api/i })).toHaveCount(0);
  });

  test('nonsense name search stays empty', async ({ browser }) => {
    const page = await signedInPage(browser, `catalog-empty-${Date.now()}@example.com`);
    await page.goto('/plants');
    await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
    await page.getByPlaceholder('Search name / species / variety').fill('zzzxnotaplant999');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('No plants match')).toBeVisible();
  });
});
