import { test, expect } from '@playwright/test';
import {
  addTransplant,
  createSizedBed,
  newUser,
  openOverview,
  saveLayout,
  confirmFixtureAddress,
} from './planner-helpers';

test('the plan saves itself, says why a save failed, retries, and undoes', async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `ui-save-${Date.now()}@example.com`);
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill('Notice garden');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Notice garden/ }).click();
  await openOverview(page);
  await createSizedBed(page, 'North');
  await saveLayout(page);

  const layout = '**/api/gardens/**/layout**';
  await page.route(layout, async (route) => {
    if (route.request().method() === 'PUT') await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Edit bed North' }).click();
  const originX = page.locator('input[name="originX"]');
  await originX.fill('1');
  await expect(page.getByText('Saving…')).toBeVisible();
  await saveLayout(page);
  await page.unroute(layout);

  await page.route(layout, (route) =>
    route.request().method() === 'PUT' ? route.abort() : route.continue(),
  );
  await originX.fill('2');
  await expect(page.getByText(/^Not saved:/)).toBeVisible();
  await page.unroute(layout);
  await page.getByRole('button', { name: 'Retry' }).click();
  await saveLayout(page);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(originX).toHaveValue('1');
  await saveLayout(page);
});

test('Add transplant notice; a valid drop can be undone; miss stays until Dismiss', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const owner = await newUser(browser, `ui-drop-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await owner.getByPlaceholder('Property name').fill('Drop garden');
  await confirmFixtureAddress(owner);
  await owner.getByRole('button', { name: 'Create property' }).click();
  await owner.getByRole('link', { name: /Drop garden/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  await saveLayout(owner);
  await owner.getByRole('link', { name: 'Transplants' }).click();
  await addTransplant(owner, 'Tomato (Cherry)');
  await expect(owner.getByLabel('Notification')).toContainText('Transplant added');
  await owner.getByRole('link', { name: 'Plan', exact: true }).click();
  await owner.getByRole('button', { name: 'Open bed North' }).click();
  const tray = owner.getByLabel('Waiting transplants');
  await tray
    .getByRole('button', { name: 'Tomato (Cherry)' })
    .dragTo(owner.getByRole('heading', { name: 'Bed View' }));
  const miss = owner.getByLabel('Notification');
  await expect(miss).toContainText('Drop missed a bed');
  await expect(miss).toHaveAttribute('role', 'alert');
  await owner.getByRole('button', { name: 'Dismiss' }).click();
  await expect(miss).toHaveCount(0);

  await tray
    .getByRole('button', { name: 'Tomato (Cherry)' })
    .dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(owner.getByLabel('Notification')).toHaveCount(0);
});
