import { test, expect } from '@playwright/test';
import { addTransplant, inviteViewer, newUser, openOverview } from './planner-helpers';

test('planner transplants: add/delete, viewer cannot mutate, indoor items stay off garden reminders', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-tr-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-tr-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Planner transplants');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Planner transplants/ }).click();
  await openOverview(owner);
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await expect(owner.getByRole('heading', { name: 'Transplant View' })).toBeVisible();
  await addTransplant(owner, 'Cherry Tomato');
  await expect(owner.getByText(/Cherry Tomato · started/)).toBeVisible();

  await inviteViewer(owner, `planner-tr-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Planner transplants/ }).click();
  await openOverview(viewer);
  await viewer.getByRole('link', { name: 'Transplants' }).click();
  await expect(viewer.getByText(/Cherry Tomato · started/)).toBeVisible();
  await expect(viewer.getByRole('button', { name: /Add transplant/ })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: /Delete transplant/ })).toHaveCount(0);

  await owner.getByRole('link', { name: 'Garden Overview' }).click();
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await owner.getByRole('button', { name: 'Delete transplant Cherry Tomato' }).click();
  await owner.getByRole('button', { name: 'Confirm delete Cherry Tomato' }).click();
  await expect(owner.getByText(/Cherry Tomato · started/)).toHaveCount(0);
});
