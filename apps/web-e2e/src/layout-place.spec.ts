import { test, expect } from '@playwright/test';
import {
  addTransplant,
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('place plantings in Bed View, spacing/fit save gate, viewer cannot place', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `layout-place-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `layout-place-friend-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Place plot');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Place plot/ }).click();
  await owner.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await owner.locator('select[name="lastMonth"]').selectOption('4');
  await owner.locator('input[name="lastDay"]').fill('15');
  await owner.locator('select[name="firstMonth"]').selectOption('10');
  await owner.locator('input[name="firstDay"]').fill('20');
  await owner.getByRole('button', { name: 'Save garden' }).click();

  await owner.getByRole('link', { name: 'Calendar' }).click();
  await owner.getByPlaceholder('Search catalog to add').fill('Spinach');
  await owner.getByRole('button', { name: 'Search catalog' }).click();
  await owner.getByRole('button', { name: 'Add Spinach' }).click();
  await expect(owner.locator('article').filter({ hasText: 'Spinach' })).toBeVisible();

  await owner.getByRole('link', { name: 'Back to garden' }).click();
  await openOverview(owner);
  await expect(owner.getByText('Spinach')).toHaveCount(0);
  await createSizedBed(owner, 'Raised bed 1');
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Cherry Tomato');
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await owner.getByLabel('Planting tray').getByRole('button', { name: 'Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="Raised bed 1"]'),
  );
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.getByLabel('Search plants').fill('Cherry Tomato');
  const pendingPlants = owner.waitForResponse(
    (res) => res.url().includes('/api/plants') && res.request().method() === 'GET',
  );
  await owner.getByRole('button', { name: 'Apply' }).click();
  await pendingPlants;
  await owner.getByRole('button', { name: 'Arm Cherry Tomato' }).dragTo(
    owner.locator('[data-bed-name="Raised bed 1"]'),
  );
  await expect(owner.getByLabel('Notification')).toContainText('Too close to another plant');
  await expect(owner.getByRole('img', { name: 'Cherry Tomato' })).toHaveCount(1);

  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Sweet Basil');
  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await owner.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await owner.getByLabel('Planting tray').getByRole('button', { name: 'Sweet Basil' }).dragTo(
    owner.locator('[data-bed-name="Raised bed 1"]'),
  );
  await expect(owner.getByText('Too close')).toBeVisible();
  await owner.getByRole('button', { name: 'Save layout' }).click();
  await expect(owner.getByText('Layout has spacing or fit problems')).toBeVisible();

  await inviteViewer(owner, `layout-place-friend-${stamp}@example.com`);
  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Place plot/ }).click();
  await openOverview(friend);
  await friend.getByRole('button', { name: 'Raised bed 1', exact: true }).click();
  await expect(friend.getByRole('button', { name: 'Direct seed' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: 'Save layout' })).toHaveCount(0);
});
