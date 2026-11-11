import { expect, test } from '@playwright/test';
import {
  applyPlantSearch,
  createSizedBed,
  newUser,
  openOverview,
  saveLayout,
  confirmFixtureAddress,
} from './planner-helpers';

test('invalid catalog drops reject with a specific notice and no planting', async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await newUser(browser, `planner-rej-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Property name').fill('Reject bed');
  await confirmFixtureAddress(owner);
  await owner.getByRole('button', { name: 'Create property' }).click();
  await owner.getByRole('link', { name: /Reject bed/ }).click();
  await openOverview(owner);
  // 8 × 3 ft: room for basil and tomato, not for a pumpkin vine (47 in).
  await createSizedBed(owner, 'North', '8', '3');
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('button', { name: 'Open bed North' }).click();

  await applyPlantSearch(owner, 'Basil (Genovese)');
  const arm = owner.getByRole('button', { name: 'Place Basil (Genovese)' });
  await expect(arm).toBeVisible();
  await arm.dragTo(owner.getByRole('heading', { name: 'Bed View' }));
  await expect(owner.getByLabel('Notification')).toContainText('Place it inside the bed');
  await expect(owner.getByRole('img', { name: 'Basil (Genovese)' })).toHaveCount(0);
  await expect(arm).toHaveAttribute('aria-pressed', 'false');

  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await arm.dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByRole('img', { name: 'Basil (Genovese)' })).toBeVisible();

  await applyPlantSearch(owner, 'Tomato (Cherry)');
  await owner
    .getByRole('button', { name: 'Place Tomato (Cherry)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByLabel('Notification')).toContainText('Too close to another plant');
  await expect(owner.getByRole('img', { name: 'Tomato (Cherry)' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await owner.getByLabel('Zone').selectOption({ label: 'Any zone' });
  await applyPlantSearch(owner, 'Pumpkin (Connecticut Field)');
  await owner
    .getByRole('button', { name: 'Place Pumpkin (Connecticut Field)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByLabel('Notification')).toContainText(
    /Too big for this bed: needs [\d.]+ ft of space/,
  );
  await expect(owner.getByRole('img', { name: 'Pumpkin (Connecticut Field)' })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await applyPlantSearch(owner, 'Spinach (Bloomsdale)');
  await expect(owner.getByRole('button', { name: 'Place Spinach (Bloomsdale)' })).toBeVisible();
  // 1.5 in from the corner of the 96 × 36 in bed: inside it, but spinach (4 in
  // spacing) needs 2 in from the edge.
  await owner.getByRole('button', { name: 'Place Spinach (Bloomsdale)' }).click();
  const bed = owner.locator('[data-bed-name="North"]');
  const box = await bed.boundingBox();
  expect(box).toBeTruthy();
  await bed.click({ position: { x: (box!.width * 1.5) / 96, y: (box!.height * 1.5) / 36 } });
  await expect(owner.getByLabel('Notification')).toContainText('Too close to the bed edge');
  await expect(owner.getByRole('img', { name: 'Spinach (Bloomsdale)' })).toHaveCount(0);
  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await owner.context().setOffline(true);
  await owner
    .getByRole('button', { name: 'Place Spinach (Bloomsdale)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByLabel('Notification')).toContainText(/need to be online/i);
  await expect(owner.getByRole('img', { name: 'Spinach (Bloomsdale)' })).toHaveCount(0);
});
