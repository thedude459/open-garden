import { expect, test } from '@playwright/test';
import {
  applyPlantSearch,
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveGarden,
  saveLayout,
} from './planner-helpers';

test('Bed View catalog search, drag, arm-click, Save; Overview shows mark', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-cat-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-cat-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Catalog bed');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Catalog bed/ }).click();
  await owner.locator('select[name="zone"]').selectOption({ label: 'Zone 6' });
  await saveGarden(owner);
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.getByRole('button', { name: 'North', exact: true }).click();

  await expect(owner.getByLabel('Plant panel')).toBeVisible();
  await expect(owner.locator('select[name="plantZone"] option:checked')).toHaveText('Zone 6');
  await expect(owner.getByRole('button', { name: /Add Sweet Basil/ })).toHaveCount(0);

  await owner.getByLabel('Search plants').fill('Sweet Basil');
  await owner.locator('select[name="plantType"]').selectOption('vegetable');
  await applyPlantSearch(owner, 'Sweet Basil');
  await expect(owner.getByRole('button', { name: 'Arm Sweet Basil' })).toHaveCount(0);

  await owner.locator('select[name="plantType"]').selectOption({ label: 'Any type' });
  await applyPlantSearch(owner, 'Sweet Basil');
  const arm = owner.getByRole('button', { name: 'Arm Sweet Basil' });
  await expect(arm).toBeVisible();
  await expect(owner.getByText(/Fits zone 6/)).toBeVisible();

  await applyPlantSearch(owner, 'zzzznotaplantxyz');
  await expect(owner.getByText('No plants match')).toBeVisible();
  await applyPlantSearch(owner, 'Sweet Basil');
  await expect(arm).toBeVisible();

  await arm.dragTo(owner.locator('[data-bed-name="North"]'));
  await expect(owner.getByText('Unsaved changes')).toBeVisible();
  await expect(owner.getByRole('img', { name: 'Sweet Basil' })).toBeVisible();
  expect((await saveLayout(owner)).status()).toBe(200);

  const gardenId = owner.url().match(/gardens\/([^/]+)/)?.[1];
  const layoutRes = await owner.request.get(`/api/gardens/${gardenId}/layout`);
  const layout = (await layoutRes.json()) as {
    plantings: Array<{
      commonName: string;
      startMethod: string;
      placement: { bedId: string } | null;
    }>;
  };
  const seeded = layout.plantings.find((p) => p.commonName === 'Sweet Basil');
  expect(seeded?.startMethod).toBe('direct_seed');
  expect(seeded?.placement).toBeTruthy();

  await owner.getByRole('link', { name: 'Back to overview' }).click();
  await expect(owner.getByLabel('Search plants')).toHaveCount(0);
  await expect(owner.locator('.layout-plant')).toHaveCount(1);

  await owner.getByRole('button', { name: 'North', exact: true }).click();
  await applyPlantSearch(owner, 'Cherry Tomato');
  await owner.getByRole('button', { name: 'Arm Cherry Tomato' }).click();
  await expect(owner.getByRole('button', { name: 'Arm Cherry Tomato' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const bedBox = await owner.locator('[data-bed-name="North"]').boundingBox();
  expect(bedBox).toBeTruthy();
  await owner.locator('[data-bed-name="North"]').click({
    position: { x: Math.round(bedBox!.width * 0.25), y: Math.round(bedBox!.height * 0.5) },
  });
  await expect(owner.getByRole('img', { name: 'Cherry Tomato' })).toBeVisible();

  await inviteViewer(owner, `planner-cat-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Catalog bed/ }).click();
  await openOverview(viewer);
  await viewer.getByRole('button', { name: 'North', exact: true }).click();
  await expect(viewer.getByRole('button', { name: /Arm / })).toHaveCount(0);
});
