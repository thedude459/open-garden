import { test, expect } from '@playwright/test';
import {
  addTransplant,
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('planner overview: beds, areas, labels, no planting drag', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-ov-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-ov-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Planner overview');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Planner overview/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Garden Overview' }).click();
  await owner.getByRole('button', { name: 'Open bed North' }).click();
  await expect(owner.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await owner.getByLabel('Planting tray').getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('link', { name: 'Back to overview' }).click();

  const plan = owner.getByLabel('Garden plan');
  await expect(plan).toContainText('North');
  await expect(plan).toContainText('Cherry Tomato');
  await expect(owner.getByLabel('Planting tray')).toHaveCount(0);
  await expect(owner.locator('.layout-plant')).toHaveCount(0);
  await expect(owner.getByRole('button', { name: 'Place planting' })).toHaveCount(0);

  await owner.getByPlaceholder('Area name').fill('Path');
  await owner.locator('input[name="newAreaLength"]').fill('4');
  await owner.locator('input[name="newAreaWidth"]').fill('2');
  await owner.getByRole('button', { name: 'Create non-planting area' }).click();
  await expect(owner.locator('[data-area-name="Path"]')).toBeVisible();
  await expect(plan).toContainText('Path');
  expect((await saveLayout(owner)).status()).toBe(200);

  await inviteViewer(owner, `planner-ov-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Planner overview/ }).click();
  await openOverview(viewer);
  await expect(viewer.locator('[data-bed-name="North"]')).toBeVisible();
  await expect(viewer.getByLabel('Garden plan')).toContainText('Cherry Tomato');
  await expect(viewer.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
});

test('planner overview: transplants with no beds stay off the map until a bed exists', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const owner = await newUser(browser, `planner-ov-empty-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Empty overview');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Empty overview/ }).click();
  await openOverview(owner);
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Garden Overview' }).click();
  await expect(owner.locator('[data-bed-name]')).toHaveCount(0);
  await expect(owner.getByLabel('Planting tray')).toHaveCount(0);

  await createSizedBed(owner, 'First');
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('button', { name: 'Open bed First' }).click();
  await expect(owner.getByLabel('Planting tray').getByRole('button', { name: 'Cherry Tomato' })).toBeVisible();
});
