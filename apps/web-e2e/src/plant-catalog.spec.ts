import { test, expect } from '@playwright/test';
import { fixturePlace } from './fixture-place';
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
    // A tomato is drawn as one: its family has an icon of its own.
    await expect(
      page.getByRole('link', { name: /Tomato \(Cherry\)/i }).locator('[data-icon="nightshade"]'),
    ).toBeVisible();
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

  test('the plant page shows when to sow at a property and adds the crop to its plan', async ({
    browser,
  }) => {
    const page = await signedInPage(browser, `catalog-timeline-${Date.now()}@example.com`);
    const created = await page.request.post('/api/gardens', {
      data: { name: 'Timeline plot', place: fixturePlace },
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
    await page.getByPlaceholder('Search name / species / variety').fill('Tomato');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('link', { name: /Tomato \(Cherry\)/i }).click();
    const timeline = page.getByRole('region', { name: 'When to sow' });
    await expect(timeline.getByRole('combobox', { name: 'Property' })).toHaveValue(/.+/);
    // Eight to six weeks before the last frost (15 April).
    await expect(timeline.getByText(/Start indoors\s+Feb 1[89] – Mar 4/)).toBeVisible();
    await expect(timeline.getByText(/Harvest\s+\w{3} \d/)).toBeVisible();

    await timeline.getByRole('button', { name: 'Add to plan' }).click();
    await expect(page.getByText('Added to the Timeline plot calendar')).toBeVisible();
    await page.goto(`/gardens/${id}/calendar`);
    await expect(page.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toBeVisible();
  });

  test('a variety links to its crop and the crop’s other varieties', async ({ browser }) => {
    const page = await signedInPage(browser, `catalog-varieties-${Date.now()}@example.com`);
    await page.goto('/plants');
    await page.getByPlaceholder('Search name / species / variety').fill('Tomato');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('link', { name: /Tomato \(Cherry\)/i }).click();
    const varieties = page.getByRole('region', { name: 'Other varieties' });
    await expect(varieties.getByRole('link', { name: 'Tomato', exact: true })).toBeVisible();
    await expect(varieties.getByRole('link', { name: /Cherry/ })).toHaveCount(0);

    await varieties.getByRole('link', { name: 'Tomato', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tomato', exact: true })).toBeVisible();
    await expect(page.getByText(/Variety Cherry/)).toHaveCount(0);
    await expect(
      page
        .getByRole('region', { name: 'Varieties' })
        .getByRole('link', { name: 'Tomato (Cherry)' }),
    ).toBeVisible();
  });
});
