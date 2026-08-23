import { test, expect } from '@playwright/test';
import {
  addTransplant,
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('planner drag: place, restore, direct-seed, miss-bed, viewer cannot drag', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-drag-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-drag-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Planner drag');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Planner drag/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByLabel('Planting tray')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('button', { name: 'North', exact: true }).click();
  await expect(owner.getByRole('heading', { name: 'Bed View' })).toBeVisible();

  const tray = owner.getByLabel('Planting tray');
  await tray.getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByText('Unsaved changes')).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Remove from bed Cherry Tomato' }).click();
  await owner.getByRole('button', { name: 'Confirm remove Cherry Tomato' }).click();
  await expect(tray.getByRole('button', { name: 'Cherry Tomato' })).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Direct seed' }).click();
  await owner.getByLabel('Search plants').fill('Sweet Basil');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await owner.getByRole('button', { name: 'Arm Sweet Basil' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByRole('img', { name: 'Sweet Basil' })).toBeVisible();
  await expect(tray.getByRole('button', { name: 'Sweet Basil' })).toHaveCount(0);

  const plan = owner.getByLabel('Bed plan');
  const box = await plan.boundingBox();
  expect(box).toBeTruthy();
  const basilMark = owner.getByRole('img', { name: 'Sweet Basil' });
  const markBox = await basilMark.boundingBox();
  expect(markBox).toBeTruthy();
  await owner.mouse.move(markBox!.x + markBox!.width / 2, markBox!.y + markBox!.height / 2);
  await owner.mouse.down();
  await owner.mouse.move(box!.x + box!.width - 8, box!.y + 8);
  await owner.mouse.up();
  await expect(owner.getByText('Drop missed a bed')).toBeVisible();

  await tray.getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="North"]'),
  );
  await expect(owner.getByText('Too close')).toBeVisible();
  await owner.getByRole('button', { name: 'Save layout' }).click();
  await expect(owner.getByText('Layout has spacing or fit problems')).toBeVisible();

  await inviteViewer(owner, `planner-drag-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Planner drag/ }).click();
  await openOverview(viewer);
  await viewer.getByRole('button', { name: 'North', exact: true }).click();
  await expect(viewer.getByLabel('Planting tray')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Direct seed' })).toHaveCount(0);
  const before = await viewer.getByLabel('Planting tray').locator('button').count();
  if (before > 0) {
    await viewer.getByLabel('Planting tray').locator('button').first().dragTo(
      viewer.locator('[data-bed-name="North"]'),
    );
    await expect(viewer.getByLabel('Planting tray').locator('button')).toHaveCount(before);
  }
});
