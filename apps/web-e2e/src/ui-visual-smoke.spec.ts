import { test, expect, type Locator } from '@playwright/test';
import {
  newUser,
  openOverview,
  openPlantingsFromGarden,
  confirmFixtureAddress,
} from './planner-helpers';

/** Leaf fill + white label. Catches .filters painting primary buttons white. */
async function expectPrimaryPaint(btn: Locator) {
  await expect(btn).toBeVisible();
  await expect(btn).toHaveCSS('background-color', 'rgb(47, 93, 58)');
  await expect(btn).toHaveCSS('color', 'rgb(255, 255, 255)');
}

test('primary actions keep green fill and white label', async ({ page, browser }) => {
  await page.goto('/login');
  await expect(page.getByRole('img', { name: 'Open Garden' })).toBeVisible();
  await expect(page.getByText('Household garden planner')).toBeVisible();
  await expectPrimaryPaint(page.getByRole('button', { name: 'Login' }));

  const owner = await newUser(browser, `ui-visual-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await expect(owner.locator('.nav-brand img')).toBeVisible();
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Create property' }));
  await owner.getByPlaceholder('Property name').fill('Visual');
  await confirmFixtureAddress(owner);
  await owner.getByRole('button', { name: 'Create property' }).click();
  await owner.getByRole('link', { name: /Visual/ }).click();
  await openOverview(owner);
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Create bed' }));

  await owner.goto('/plants');
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Apply' }));

  await owner.goto('/gardens');
  await owner.getByRole('link', { name: /Visual/ }).click();
  await openPlantingsFromGarden(owner);
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Search catalog' }));
});

test('the mark, app icons, and favicon all load and are not empty', async ({ page }) => {
  await page.goto('/login');
  const mark = page.getByRole('img', { name: 'Open Garden' });
  await expect(mark).toHaveAttribute('src', 'assets/mark.svg');
  expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as {
    icons: { src: string; purpose: string }[];
  };
  expect(manifest.icons.map((i) => i.purpose)).toContain('maskable');
  const links = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
  for (const src of ['favicon.ico', ...links, ...manifest.icons.map((i) => i.src)]) {
    const res = await page.request.get(`/${src}`);
    expect(res.ok(), src).toBe(true);
    expect((await res.body()).length, src).toBeGreaterThan(100);
  }
});
