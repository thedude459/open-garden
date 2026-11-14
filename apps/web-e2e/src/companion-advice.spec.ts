import { test, expect } from '@playwright/test';
import {
  confirmFixtureAddress,
  createSizedBed,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('dataset companion pairs show on the plant page and in the planner', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `companions-${Date.now()}@example.com`);

  // A zone 5 property ranks pairs shown near zone 5 first.
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Companion plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Companion plot/ }).click();

  // Plant page: Tomato's pairs, grouped, with evidence and where each was shown.
  await page.goto('/plants');
  await page.getByPlaceholder('Search name / species / variety').fill('Tomato');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: /Tomato — Solanum/ }).click();
  const companions = page.locator('section.companions');
  await expect(companions.getByRole('heading', { name: 'Companions' })).toBeVisible();
  await expect(companions.getByRole('heading', { name: 'Grows well with' })).toBeVisible();
  await expect(companions.getByText('Basil', { exact: true })).toBeVisible();
  await expect(companions.getByRole('heading', { name: 'Keep apart from' })).toBeVisible();
  await expect(companions.getByText(/Both get late blight/)).toBeVisible();
  await expect(companions.getByText(/Shown in Minnesota, USA \(zones 3–5\)/)).toBeVisible();

  // Planner: basil and tomato in one bed get a companion note; advice only.
  await page.goto('/gardens');
  await page.getByRole('link', { name: /Companion plot/ }).click();
  await createSizedBed(page, 'North');
  expect((await saveLayout(page)).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Open bed North' }).click();
  await page.getByLabel('Zone').selectOption({ label: 'Any zone' });
  const bed = page.locator('[data-bed-name="North"]');
  const box = await bed.boundingBox();
  const place = async (search: string, name: string, x: number) => {
    await page.getByLabel('Search plants').fill(search);
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: `Place ${name}` }).dragTo(bed, {
      targetPosition: { x: Math.round(box!.width * x), y: Math.round(box!.height * 0.5) },
    });
    await expect(page.getByRole('img', { name })).toHaveCount(1);
  };
  await place('Basil', 'Basil (Genovese)', 0.25);
  await place('Tomato', 'Tomato (Cherry)', 0.75);
  expect((await saveLayout(page)).ok()).toBeTruthy();

  // The pairs come with the saved layout.
  await openOverview(page);
  const fresh = page.waitForResponse(
    (res) => res.url().endsWith('/layout') && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Open bed North' }).click();
  await fresh;
  await expect(page.getByText(/(Basil helps Tomato|Tomato helps Basil) — Basil/)).toBeVisible();
});
