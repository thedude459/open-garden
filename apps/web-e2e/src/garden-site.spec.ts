import { test, expect } from '@playwright/test';
import { signedInPage } from './session';
import { saveGarden, openConfiguration, confirmFixtureAddress } from './planner-helpers';

test('site profile persists, can clear one frost, and rejects reversed pairs', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `site-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Zone seven');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Zone seven/ }).click();
  await openConfiguration(page);
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await saveGarden(page);
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 7');
  await expect(page.getByText(/1600 Pennsylvania Avenue NW/)).toBeVisible();
  await page.reload();
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 7');
  await expect(page.getByText(/1600 Pennsylvania Avenue NW/)).toBeVisible();
  await page.locator('select[name="firstMonth"]').selectOption({ label: 'Month' });
  await page.locator('input[name="firstDay"]').fill('');
  await saveGarden(page);
  await expect(
    page.getByRole('group', { name: /First frost/i }).getByText(/Not set/i),
  ).toBeVisible();
  await page.locator('select[name="lastMonth"]').selectOption('10');
  await page.locator('input[name="lastDay"]').fill('20');
  await page.locator('select[name="firstMonth"]').selectOption('4');
  await page.locator('input[name="firstDay"]').fill('15');
  await page.getByRole('button', { name: 'Save garden' }).click();
  await expect(page.getByText(/last frost must be earlier/i)).toBeVisible();
});

test('settings come in sections, and the address can fill the climate in again', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `site-refill-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Refill plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Refill plot/ }).click();
  await openConfiguration(page);
  const sections = page.getByRole('navigation', { name: 'Settings sections' });
  await sections.getByRole('link', { name: 'Location & climate' }).click();
  await expect(page).toHaveURL(/#climate$/);
  const climate = page.getByRole('region', { name: 'Location & climate' });
  // The address filled in zone 8; change it by hand, then ask for the address's again.
  await expect(climate.locator('select[name="zone"] option:checked')).toHaveText('Zone 8');
  await climate.locator('select[name="zone"]').selectOption({ label: 'Zone 6' });
  await saveGarden(page);
  await expect(climate.locator('select[name="zone"] option:checked')).toHaveText('Zone 6');
  await climate.getByRole('button', { name: "Use this address's climate" }).click();
  await expect(climate.locator('select[name="zone"] option:checked')).toHaveText('Zone 8');
  await page.reload();
  await expect(page.locator('select[name="zone"] option:checked')).toHaveText('Zone 8');
});
