import { test, expect } from '@playwright/test';
import {
  applyPlantSearch,
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('Bed View on-mark prefixes, no bed size caption, select shows full name', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `bed-labels-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `bed-labels-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Quiet bed');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Quiet bed/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  await createSizedBed(owner, 'South');
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('button', { name: 'Open bed South' }).click();
  await expect(owner.getByLabel('Bed plan')).not.toContainText('Bed ·');
  await expect(owner.getByLabel('Bed plan')).not.toContainText('ft');
  await owner.getByRole('link', { name: 'Back to overview' }).click();

  await owner.getByRole('button', { name: 'Open bed North' }).click();
  await expect(owner.getByLabel('Bed plan')).not.toContainText('Bed ·');
  await owner.getByRole('button', { name: 'Direct seed' }).click();
  await applyPlantSearch(owner, 'Sweet Basil');
  const bed = owner.locator('[data-bed-name="North"]');
  const arm = owner.getByRole('button', { name: 'Place Sweet Basil' });
  await expect(arm).toBeVisible();
  const bedBox = await bed.boundingBox();
  expect(bedBox).toBeTruthy();
  await arm.dragTo(bed, {
    targetPosition: { x: Math.round(bedBox!.width * 0.3), y: Math.round(bedBox!.height * 0.5) },
  });
  await expect(owner.getByRole('img', { name: 'Sweet Basil' })).toHaveCount(1);
  await arm.dragTo(bed, {
    targetPosition: { x: Math.round(bedBox!.width * 0.7), y: Math.round(bedBox!.height * 0.5) },
  });
  await expect(owner.getByRole('img', { name: 'Sweet Basil' })).toHaveCount(2);
  const labels = owner.getByLabel('Bed plan').locator('.layout-plant-label');
  await expect(labels).toHaveCount(2);
  const markText = ((await labels.first().textContent()) ?? '').trim();
  expect(markText.length).toBeGreaterThan(0);
  expect(markText.length).toBeLessThan('Sweet Basil'.length);
  expect('Sweet Basil'.startsWith(markText)).toBe(true);

  const first = owner.getByRole('img', { name: 'Sweet Basil' }).first();
  const box = await first.boundingBox();
  expect(box).toBeTruthy();
  await owner.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(owner.getByRole('status').filter({ hasText: 'Sweet Basil' })).toBeVisible();

  const planBox = await owner.getByLabel('Bed plan').boundingBox();
  expect(planBox).toBeTruthy();
  await owner.mouse.click(planBox!.x + 8, planBox!.y + 8);
  await expect(owner.getByRole('status').filter({ hasText: 'Sweet Basil' })).toHaveCount(0);

  expect((await saveLayout(owner)).status()).toBe(200);
  await inviteViewer(owner, `bed-labels-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Quiet bed/ }).click();
  await openOverview(viewer);
  await viewer.getByRole('button', { name: 'Open bed North' }).click();
  await expect(viewer.getByRole('img', { name: 'Sweet Basil' })).toHaveCount(2);
  const mark = viewer.getByRole('img', { name: 'Sweet Basil' }).first();
  const markBox = await mark.boundingBox();
  expect(markBox).toBeTruthy();
  await viewer.mouse.move(markBox!.x + markBox!.width / 2, markBox!.y + markBox!.height / 2);
  await viewer.mouse.down();
  await viewer.mouse.move(markBox!.x + markBox!.width / 2 + 40, markBox!.y + markBox!.height / 2, {
    steps: 6,
  });
  await viewer.mouse.up();
  await expect(viewer.getByText('Unsaved changes')).toHaveCount(0);
});
