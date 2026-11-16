import { test, expect } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('filters narrow list', async ({ browser }) => {
  const page = await signedInPage(browser, `filters-${Date.now()}@example.com`);
  await page.goto('/plants');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await expect(
    page
      .getByRole('link')
      .filter({ hasText: /Tomato|Basil|Maple/i })
      .first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.locator('select[name="plantType"]').selectOption('herb');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/Basil \(Genovese\)/i)).toBeVisible();
});

test('family and "can sow now" narrow the catalog', async ({ browser }) => {
  const page = await signedInPage(browser, `sow-now-${Date.now()}@example.com`);
  await page.clock.install({ time: new Date('2026-04-15T15:00:00') });
  const created = await page.request.post('/api/gardens', {
    data: { name: 'Sow now plot', place: fixturePlace },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const saved = await page.request.patch(`/api/gardens/${id}`, {
    data: {
      hardinessZone: 7,
      lastFrost: { month: 4, day: 15 },
      firstFrost: { month: 10, day: 20 },
    },
  });
  expect(saved.ok()).toBeTruthy();

  await page.goto('/plants');
  const search = page.getByPlaceholder('Search name / species / variety');
  await search.fill('Radish');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Radish (Cherry Belle)')).toBeVisible();

  // Radish is sown from five weeks before to two weeks after the last frost (15 April).
  await page
    .getByRole('combobox', { name: 'Can sow now' })
    .selectOption({ label: 'Can sow this week at Sow now plot' });
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Radish (Cherry Belle)')).toBeVisible();
  // Tomato starts indoors in February and goes out after this week.
  await search.fill('Tomato');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Nothing opens to sow or plant there this week')).toBeVisible();

  await page.getByRole('combobox', { name: 'Can sow now' }).selectOption({ label: 'Any time' });
  await page.getByRole('combobox', { name: 'Family' }).selectOption('Cabbage family');
  await search.fill('');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Radish (Cherry Belle)')).toBeVisible();
  await expect(page.getByText('Tomato (Cherry)')).toHaveCount(0);
});
