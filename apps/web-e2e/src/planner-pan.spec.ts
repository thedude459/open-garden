import { test, expect } from '@playwright/test';
import { createSizedBed, inviteViewer, newUser, openOverview, saveLayout } from './planner-helpers';

test('planner pan: empty space pans, bed drag moves origin, zoom, viewer pans only', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-pan-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-pan-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Planner pan');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Planner pan/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'East');
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Edit size East' }).click();
  const origin = owner.locator('input[name="originX"]');
  await expect(origin).toBeVisible();
  const startOrigin = await origin.inputValue();

  const plan = owner.getByLabel('Garden plan');
  const box = await plan.boundingBox();
  expect(box).toBeTruthy();
  await owner.mouse.move(box!.x + box!.width - 12, box!.y + 12);
  await owner.mouse.down();
  await owner.mouse.move(box!.x + box!.width - 80, box!.y + 40);
  await owner.mouse.up();
  await expect(origin).toHaveValue(startOrigin);

  await owner.locator('[data-bed-name="East"]').dragTo(plan, { targetPosition: { x: 100, y: 60 } });
  await expect(origin).not.toHaveValue(startOrigin);
  const moved = await origin.inputValue();
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(origin).toHaveValue(moved);

  await owner.getByRole('button', { name: 'Zoom in' }).click();
  await owner.getByRole('button', { name: 'Zoom out' }).click();
  await expect(plan).toBeVisible();

  await inviteViewer(owner, `planner-pan-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Planner pan/ }).click();
  await openOverview(viewer);
  await expect(viewer.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
  const vPlan = viewer.getByLabel('Garden plan');
  const vBox = await vPlan.boundingBox();
  expect(vBox).toBeTruthy();
  await viewer.mouse.move(vBox!.x + vBox!.width - 12, vBox!.y + 12);
  await viewer.mouse.down();
  await viewer.mouse.move(vBox!.x + vBox!.width - 70, vBox!.y + 30);
  await viewer.mouse.up();
  await expect(viewer.locator('[data-bed-name="East"]')).toBeVisible();
  const bedBox = await viewer.locator('[data-bed-name="East"]').boundingBox();
  expect(bedBox).toBeTruthy();
  await viewer.mouse.move(bedBox!.x + bedBox!.width / 2, bedBox!.y + bedBox!.height / 2);
  await viewer.mouse.down();
  await viewer.mouse.move(bedBox!.x + bedBox!.width / 2 + 40, bedBox!.y + bedBox!.height / 2 + 20, {
    steps: 8,
  });
  await viewer.mouse.up();
  await expect(viewer.getByRole('button', { name: /Rotate/ })).toHaveCount(0);
});
