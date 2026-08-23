import { test, expect } from '@playwright/test';
import { addTransplant, createSizedBed, newUser, openOverview, saveLayout } from './planner-helpers';

test('planner diagram: names, distinct areas, grid in Bed View, planting marks on Overview', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const owner = await newUser(browser, `planner-diagram-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Planner diagram');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Planner diagram/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'Raised bed 1');
  await owner.getByPlaceholder('Area name').fill('Path');
  await owner.locator('input[name="newAreaLength"]').fill('48');
  await owner.locator('input[name="newAreaWidth"]').fill('24');
  await owner.getByRole('button', { name: 'Create non-planting area' }).click();
  expect((await saveLayout(owner)).status()).toBe(200);

  const overview = owner.getByLabel('Garden plan');
  await expect(overview).toContainText('Raised bed 1');
  await expect(overview).toContainText('Path');
  await expect(owner.locator('.layout-area')).toBeVisible();
  await expect(owner.locator('.layout-grid')).toHaveCount(0);
  await expect(owner.locator('.layout-plant')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await owner.getByLabel('Planting tray').getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="Raised bed 1"]'),
  );
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByLabel('Bed plan')).toContainText('Cherry Tomato');
  await expect(owner.locator('.layout-grid')).not.toHaveCount(0);
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await expect(owner.getByLabel('Garden plan')).toContainText('Cherry Tomato');
  await expect(owner.locator('.layout-plant')).toHaveCount(1);
});
