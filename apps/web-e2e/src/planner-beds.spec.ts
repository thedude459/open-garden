import { test, expect } from '@playwright/test';
import { createSizedBed, inviteViewer, newUser, openOverview, saveLayout } from './planner-helpers';

test('planner beds: create bed and area, select opens Bed View, viewer cannot mutate', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-bed-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-bed-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Planner beds');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Planner beds/ }).click();
  await openOverview(owner);

  await owner.getByPlaceholder('Bed name').fill('No size');
  await owner.locator('input[name="newLength"]').fill('');
  await owner.locator('input[name="newWidth"]').fill('');
  await owner.getByRole('button', { name: 'Create bed' }).click();
  await expect(owner.getByRole('button', { name: 'Open bed No size' })).toHaveCount(0);
  await expect(owner.getByText('Unsaved changes')).toHaveCount(0);

  await createSizedBed(owner, 'East');
  await expect(owner.getByText('Unsaved changes')).toBeVisible();
  await expect(owner.locator('[data-bed-name="East"]')).toBeVisible();
  await owner.getByRole('link', { name: 'Configuration' }).click();
  await openOverview(owner);
  await expect(owner.locator('[data-bed-name="East"]')).toHaveCount(0);

  await createSizedBed(owner, 'East');
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByText('Unsaved changes')).toHaveCount(0);

  await owner.getByPlaceholder('Area name').fill('Compost');
  await owner.locator('input[name="newAreaLength"]').fill('3');
  await owner.locator('input[name="newAreaWidth"]').fill('2');
  await owner.getByRole('button', { name: 'Create non-planting area' }).click();
  await expect(owner.locator('[data-area-name="Compost"]')).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Delete area Compost' }).click();
  await owner.getByRole('button', { name: 'Cancel' }).click();
  await expect(owner.locator('[data-area-name="Compost"]')).toBeVisible();
  await owner.getByRole('button', { name: 'Delete area Compost' }).click();
  await owner.getByRole('button', { name: 'Confirm delete Compost' }).click();
  await expect(owner.locator('[data-area-name="Compost"]')).toHaveCount(0);

  await owner.getByRole('button', { name: 'Open bed East' }).click();
  await expect(owner.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await expect(owner.getByLabel('Bed plan')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
  await expect(owner.getByRole('button', { name: 'Create non-planting area' })).toHaveCount(0);
  await owner.getByRole('link', { name: 'Back to overview' }).click();

  await owner.getByRole('button', { name: 'Edit size East' }).click();
  await owner.getByRole('button', { name: 'Rotate 90°' }).click();
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByText('8 × 4 ft · 90°')).toBeVisible();

  await inviteViewer(owner, `planner-bed-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Planner beds/ }).click();
  await openOverview(viewer);
  await expect(viewer.locator('[data-bed-name="East"]')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Open bed East' }).click();
  await expect(viewer.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Direct seed' })).toHaveCount(0);
});
