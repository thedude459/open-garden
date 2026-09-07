import { test, expect } from '@playwright/test';
import { signedInPage } from './session';
import { saveGarden } from './planner-helpers';

test('site profile persists, can clear one frost, and rejects reversed pairs', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `site-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Garden name').fill('Zone seven');
  await page.getByRole('button', { name: 'Create garden' }).click();
  await page.getByRole('link', { name: /Zone seven/ }).click();
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await saveGarden(page);
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 7');
  await page.reload();
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 7');
  await page.locator('select[name="firstMonth"]').selectOption({ label: 'Month' });
  await page.locator('input[name="firstDay"]').fill('');
  await saveGarden(page);
  await expect(page.getByRole('group', { name: /First frost/i }).getByText(/Not set/i)).toBeVisible();
  await page.locator('select[name="lastMonth"]').selectOption('10');
  await page.locator('input[name="lastDay"]').fill('20');
  await page.locator('select[name="firstMonth"]').selectOption('4');
  await page.locator('input[name="firstDay"]').fill('15');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await expect(page.getByText(/last frost must be earlier/i)).toBeVisible();
});
