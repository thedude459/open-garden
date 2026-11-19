import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('next season is planned on its own plan while this one grows (ADR 0040)', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `next-season-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Next plot', place: fixturePlace } })
  ).json()) as { id: string };
  const bed = (await (
    await page.request.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  const sized = await page.request.put(`/api/gardens/${garden.id}/layout`, {
    data: {
      beds: [
        {
          id: bed.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0,
        },
      ],
      placements: [],
    },
  });
  expect(sized.status(), await sized.text()).toBe(200);
  const year = new Date().getUTCFullYear();

  await page.goto(`/gardens/${garden.id}/layout/beds/${bed.id}`);
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  const season = page.getByLabel('Season');
  await expect(season).toHaveValue(String(year));
  await season.selectOption({ label: `${year + 1} (planning)` });
  await expect(season).toHaveValue(String(year + 1));

  // Place basil on next year's plan.
  await page.getByRole('button', { name: 'Direct seed' }).click();
  await page.getByLabel('Search plants').fill('Basil');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page
    .getByRole('button', { name: 'Place Basil (Genovese)' })
    .dragTo(page.locator('[data-bed-name="North"]'));
  await expect(page.getByRole('img', { name: 'Basil (Genovese), planned' })).toBeVisible();
  await expect(page.getByText('All changes saved')).toBeVisible();

  // This season's bed is still empty.
  await season.selectOption({ label: `${year} (now)` });
  await expect(season).toHaveValue(String(year));
  await expect(page.getByRole('img', { name: /Basil/ })).toHaveCount(0);

  // Plantings lists it under next year only.
  await page.goto(`/gardens/${garden.id}/plantings`);
  const basil = page.locator('article').filter({ hasText: 'Basil (Genovese)' });
  await expect(page.getByRole('heading', { name: 'Plantings' })).toBeVisible();
  await expect(basil).toHaveCount(0);
  await page.getByLabel('Season').selectOption({ label: `${year + 1} (planning)` });
  await expect(basil).toHaveCount(1);
  await expect(basil.getByText('Planned', { exact: true })).toBeVisible();
});
