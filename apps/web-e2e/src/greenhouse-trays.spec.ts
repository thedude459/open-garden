import { expect, test } from '@playwright/test';
import {
  confirmFixtureAddress,
  createSizedBed,
  newUser,
  openAdd,
  openOverview,
  openPlantingsFromGarden,
  saveLayout,
} from './planner-helpers';

test('start a seedling in a greenhouse tray, then plant it out in a bed', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `trays-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Tray plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Tray plot/ }).click();

  // A tray and a bed on the plan.
  await openOverview(page);
  await openAdd(page, 'Add tray');
  await page.getByPlaceholder('Tray name').fill('Seed tray A');
  await page.getByRole('button', { name: 'Create tray' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Seed tray A' })).toBeVisible();
  await createSizedBed(page, 'North');
  await saveLayout(page);

  // Start a tomato in the tray.
  await openPlantingsFromGarden(page);
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Start Tomato (Cherry) in a tray' }).click();
  const tomato = page.locator('article').filter({ hasText: 'Tomato (Cherry)' });
  await expect(tomato.getByText('In a tray', { exact: true })).toBeVisible();

  // Plant it out: it waits beside the bed, then moves into it.
  await openOverview(page);
  await page.getByRole('button', { name: 'Open bed North' }).click();
  const waiting = page.getByLabel('Waiting transplants');
  await expect(waiting.getByRole('button', { name: 'Tomato (Cherry)' })).toBeVisible();
  await waiting
    .getByRole('button', { name: 'Tomato (Cherry)' })
    .dragTo(page.locator('[data-bed-name="North"]'));
  await expect(page.getByRole('img', { name: 'Tomato (Cherry)' })).toBeVisible();
  await saveLayout(page);

  await openPlantingsFromGarden(page);
  await expect(tomato.getByText('In a tray', { exact: true })).toHaveCount(0);
  await expect(tomato.getByText('Transplant', { exact: true })).toBeVisible();
  // Nothing new to search for: the planting moved, it was not copied.
  await expect(page.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toHaveCount(1);
});
