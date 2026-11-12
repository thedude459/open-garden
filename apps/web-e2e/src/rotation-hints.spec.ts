import { test, expect } from '@playwright/test';
import {
  confirmFixtureAddress,
  createSizedBed,
  newUser,
  openConfiguration,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('a crop of last year’s family in the same bed gets a rotation hint', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await newUser(browser, `rotation-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Rotation plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Rotation plot/ }).click();
  await createSizedBed(page, 'North');
  expect((await saveLayout(page)).ok()).toBeTruthy();

  const place = async (search: string, name: string) => {
    // Bed View shows the cached layout first; wait for the fresh one, which no
    // longer holds last season's annuals.
    const fresh = page.waitForResponse(
      (res) => res.url().endsWith('/layout') && res.request().method() === 'GET',
    );
    await page.getByRole('button', { name: 'Open bed North' }).click();
    await fresh;
    await page.getByLabel('Zone').selectOption({ label: 'Any zone' });
    await page.getByLabel('Search plants').fill(search);
    await page.getByRole('button', { name: 'Apply' }).click();
    await page
      .getByRole('button', { name: `Place ${name}` })
      .dragTo(page.locator('[data-bed-name="North"]'));
    await expect(page.getByRole('img', { name })).toHaveCount(1);
  };

  await place('Kale', 'Kale (Lacinato)');
  expect((await saveLayout(page)).ok()).toBeTruthy();

  await openConfiguration(page);
  await page.getByRole('button', { name: 'Close season' }).click();
  await expect(page.getByText('Season closed')).toBeVisible();

  await openOverview(page);
  await place('Broccoli', 'Broccoli (Waltham 29)');
  // Advice only: the layout still saves.
  await expect(
    page.getByText('Broccoli: Kale (cabbage family) grew in this bed last year'),
  ).toBeVisible();
  expect((await saveLayout(page)).ok()).toBeTruthy();
});
