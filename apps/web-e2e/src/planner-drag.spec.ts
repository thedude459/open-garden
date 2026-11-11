import { test, expect } from '@playwright/test';
import {
  addTransplant,
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveLayout,
  confirmFixtureAddress,
} from './planner-helpers';

test('planner drag: place, restore, direct-seed, miss-bed, viewer cannot drag', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-drag-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-drag-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Property name').fill('Planner drag');
  await confirmFixtureAddress(owner);
  await owner.getByRole('button', { name: 'Create property' }).click();
  await owner.getByRole('link', { name: /Planner drag/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);
  await expect(owner.getByLabel('Waiting transplants')).toHaveCount(0);

  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Tomato (Cherry)');
  await owner.getByRole('link', { name: 'Garden Overview' }).click();
  await owner.getByRole('button', { name: 'Open bed North' }).click();
  await expect(owner.getByRole('heading', { name: 'Bed View' })).toBeVisible();

  const tray = owner.getByLabel('Waiting transplants');
  await tray
    .getByRole('button', { name: 'Tomato (Cherry)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByText('Unsaved changes')).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Remove from bed Tomato (Cherry)' }).click();
  await owner.getByRole('button', { name: 'Confirm remove Tomato (Cherry)' }).click();
  await expect(tray.getByRole('button', { name: 'Tomato (Cherry)' })).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Direct seed' }).click();
  await owner.getByLabel('Search plants').fill('Basil');
  await owner.getByRole('button', { name: 'Apply' }).click();
  await owner
    .getByRole('button', { name: 'Place Basil (Genovese)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByRole('img', { name: 'Basil (Genovese)' })).toBeVisible();
  await expect(tray.getByRole('button', { name: 'Basil (Genovese)' })).toHaveCount(0);

  const plan = owner.getByLabel('Bed plan');
  const box = await plan.boundingBox();
  expect(box).toBeTruthy();
  const basilMark = owner.getByRole('img', { name: 'Basil (Genovese)' });
  const markBox = await basilMark.boundingBox();
  expect(markBox).toBeTruthy();
  await owner.mouse.move(markBox!.x + markBox!.width / 2, markBox!.y + markBox!.height / 2);
  await owner.mouse.down();
  await owner.mouse.move(box!.x + box!.width - 8, box!.y + 8, { steps: 8 });
  await owner.mouse.up();
  await expect(owner.getByText('Drop missed a bed')).toBeVisible();

  await tray
    .getByRole('button', { name: 'Tomato (Cherry)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByLabel('Notification')).toContainText('Too close to another plant');
  await expect(tray.getByRole('button', { name: 'Tomato (Cherry)' })).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  await inviteViewer(owner, `planner-drag-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Planner drag/ }).click();
  await openOverview(viewer);
  await viewer.getByRole('button', { name: 'Open bed North' }).click();
  await expect(viewer.getByLabel('Waiting transplants')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Direct seed' })).toHaveCount(0);
  const before = await viewer.getByLabel('Waiting transplants').locator('button').count();
  if (before > 0) {
    await viewer
      .getByLabel('Waiting transplants')
      .locator('button')
      .first()
      .dragTo(viewer.locator('[data-bed-name="North"]'));
    await expect(viewer.getByLabel('Waiting transplants').locator('button')).toHaveCount(before);
  }
});
