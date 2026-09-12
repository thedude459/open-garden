import { test, expect } from '@playwright/test';
import { createSizedBed, newUser, openOverview, saveLayout, uniqueEmail } from './planner-helpers';

test('place marker, Open bed keyboard, click vs drag, Bed/Area labels', async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await newUser(browser, uniqueEmail('ui-place'));
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Marker garden');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Marker garden/ }).click();
  await openOverview(owner);
  await expect(owner.getByLabel('You are here')).toContainText('Garden Overview');
  await createSizedBed(owner, 'North');
  await owner.getByPlaceholder('Area name').fill('Path');
  await owner.locator('input[name="newAreaLength"]').fill('4');
  await owner.locator('input[name="newAreaWidth"]').fill('2');
  await owner.getByRole('button', { name: 'Create non-planting area' }).click();
  expect((await saveLayout(owner)).status()).toBe(200);

  const plan = owner.getByLabel('Garden plan');
  await expect(plan).toContainText('Bed · North');
  await expect(plan).toContainText('Area · Path');
  await expect(owner.locator('[data-kind="bed"]')).toBeVisible();
  await expect(owner.locator('[data-kind="area"]')).toBeVisible();

  await owner.getByRole('button', { name: 'Open bed North' }).focus();
  await owner.keyboard.press('Enter');
  await expect(owner.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await expect(owner.getByLabel('You are here')).toContainText('North');
  await expect(owner.getByLabel('Bed plan')).not.toContainText('Bed ·');
  await owner.getByRole('link', { name: 'Back to overview' }).click();

  await owner.locator('[data-bed-name="North"]').click({ position: { x: 4, y: 4 } });
  await expect(owner.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await owner.getByRole('link', { name: 'Back to overview' }).click();

  const bed = owner.locator('[data-bed-name="North"]');
  const box = await bed.boundingBox();
  if (box) {
    await owner.mouse.move(box.x + 8, box.y + 8);
    await owner.mouse.down();
    await owner.mouse.move(box.x + 40, box.y + 8);
    await owner.mouse.up();
  }
  await expect(owner.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await expect(owner.getByText('Unsaved changes')).toBeVisible();

  await owner.setViewportSize({ width: 390, height: 844 });
  await expect(owner.getByRole('button', { name: 'Open bed North' })).toBeVisible();
  await owner.getByRole('button', { name: 'Open bed North' }).click();
  await expect(owner.getByRole('link', { name: 'Back to overview' })).toBeVisible();
});
