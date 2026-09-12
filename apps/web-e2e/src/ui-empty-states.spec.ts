import { test, expect } from '@playwright/test';
import { createSizedBed, inviteViewer, newUser, openOverview, saveLayout } from './planner-helpers';

test('empty gardens, overview, and bed view next steps; viewer has no Create bed', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `ui-empty-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `ui-empty-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await expect(owner.getByText(/No gardens yet/i)).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create garden' })).toBeVisible();
  await owner.getByPlaceholder('Garden name').fill('Empty steps');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Empty steps/ }).click();
  await openOverview(owner);
  await expect(owner.getByText(/Add a named bed/i)).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create bed' })).toBeVisible();
  await expect(owner.getByRole('link', { name: 'Set your site' })).toBeVisible();
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('button', { name: 'Open bed North' }).click();
  await expect(owner.getByRole('button', { name: 'Direct seed' })).toBeVisible();
  await owner.getByRole('button', { name: 'Direct seed' }).click();
  await expect(owner.getByLabel('Search plants')).toBeFocused();
  await expect(owner.getByRole('link', { name: 'Back to overview' })).toBeVisible();

  await inviteViewer(owner, `ui-empty-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Empty steps/ }).click();
  await openOverview(viewer);
  await expect(viewer.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
});
