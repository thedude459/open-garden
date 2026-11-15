import { test, expect, type Page } from '@playwright/test';
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
  await basilAndTomatoInOneBed(page, 'Companion plot');

  // The pairs come with the saved layout.
  await reopenBedNorth(page);
  await expect(page.getByText(/(Basil helps Tomato|Tomato helps Basil) — Basil/)).toBeVisible();
});

test("a household's own pair replaces the dataset's for the same two plants", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `companions-own-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Own pairs plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Own pairs plot/ }).click();
  await basilAndTomatoInOneBed(page, 'Own pairs plot');

  // Settings: the household says tomato hinders its basil.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.locator('select[name="pairLeft"]').selectOption({ label: 'Tomato' });
  await page.locator('select[name="pairKind"]').selectOption('hinders');
  await page.locator('select[name="pairRight"]').selectOption({ label: 'Basil' });
  await page.locator('input[name="pairReason"]').fill('Shades our basil');
  await page.getByRole('button', { name: 'Add pair' }).click();
  await expect(page.getByText('Tomato hinders Basil — Shades our basil')).toBeVisible();

  // Planner: the household's pair, not the dataset's, for these two plants.
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await reopenBedNorth(page);
  await expect(page.getByText(/Tomato hinders Basil — Shades our basil/)).toBeVisible();
  await expect(page.getByText(/(Basil helps Tomato|Tomato helps Basil) — Basil/)).toHaveCount(0);
});

/** On the property's Plan page: a North bed with basil and tomato placed and saved. */
async function basilAndTomatoInOneBed(page: Page, property: string) {
  await page.goto('/gardens');
  await page.getByRole('link', { name: new RegExp(property) }).click();
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
}

/** Opens bed North from the overview once its saved layout has loaded. */
async function reopenBedNorth(page: Page) {
  await openOverview(page);
  const fresh = page.waitForResponse(
    (res) => res.url().endsWith('/layout') && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Open bed North' }).click();
  await fresh;
}
