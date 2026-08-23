import { expect, test } from '@playwright/test';
import {
  createSizedBed,
  inviteViewer,
  newUser,
  openOverview,
  saveLayout,
} from './planner-helpers';

test('Overview create uses visible viewport center; grab-offset move; viewer cannot create', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `planner-place-owner-${stamp}@example.com`);
  const viewer = await newUser(browser, `planner-place-viewer-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Place map');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Place map/ }).click();
  await openOverview(owner);
  await expect(owner.getByLabel('Search plants')).toHaveCount(0);
  await expect(owner.getByLabel('Plant panel')).toHaveCount(0);

  await owner.getByRole('button', { name: 'Zoom in' }).click();
  await owner.getByRole('button', { name: 'Zoom in' }).click();
  const plan = owner.getByLabel('Garden plan');
  const box = await plan.boundingBox();
  expect(box).toBeTruthy();
  await owner.mouse.move(box!.x + 20, box!.y + 20);
  await owner.mouse.down();
  await owner.mouse.move(box!.x + 80, box!.y + 50, { steps: 6 });
  await owner.mouse.up();

  await createSizedBed(owner, 'North');
  const vp = await plan.boundingBox();
  const north = await owner.locator('[data-bed-name="North"]').boundingBox();
  expect(vp && north).toBeTruthy();
  const cx = north!.x + north!.width / 2;
  const cy = north!.y + north!.height / 2;
  expect(cx).toBeGreaterThan(vp!.x);
  expect(cx).toBeLessThan(vp!.x + vp!.width);
  expect(cy).toBeGreaterThan(vp!.y);
  expect(cy).toBeLessThan(vp!.y + vp!.height);

  await owner.getByRole('button', { name: 'Edit size North' }).click();
  const originX = owner.locator('input[name="originX"]');
  const originY = owner.locator('input[name="originY"]');
  expect(Number(await originX.inputValue()) === 0 && Number(await originY.inputValue()) === 0).toBe(
    false,
  );
  expect((await saveLayout(owner)).status()).toBe(200);

  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await owner.getByRole('button', { name: 'Edit size North' }).click();
  const ox = await originX.inputValue();
  await owner.locator('[data-bed-name="North"]').dragTo(plan, { targetPosition: { x: 100, y: 60 } });
  await expect(originX).not.toHaveValue(ox);
  const movedX = await originX.inputValue();
  const movedY = await originY.inputValue();

  await owner.getByPlaceholder('Area name').fill('Path');
  await owner.locator('input[name="newAreaLength"]').fill('48');
  await owner.locator('input[name="newAreaWidth"]').fill('24');
  await owner.getByRole('button', { name: 'Create non-planting area' }).click();
  await expect(owner.locator('[data-area-name="Path"]')).toBeVisible();

  expect((await saveLayout(owner)).status()).toBe(200);
  await owner.reload({ waitUntil: 'domcontentloaded' });
  await expect(owner.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await owner.getByRole('button', { name: 'Edit size North' }).click();
  await expect(originX).toHaveValue(movedX);
  await expect(originY).toHaveValue(movedY);
  await expect(owner.locator('[data-area-name="Path"]')).toBeVisible();

  const gardenId = owner.url().match(/gardens\/([^/]+)/)?.[1];
  expect(gardenId).toBeTruthy();
  const layoutRes = await owner.request.get(`/api/gardens/${gardenId}/layout`);
  expect(layoutRes.ok()).toBeTruthy();
  const layout = (await layoutRes.json()) as {
    beds: Array<{ name: string; geometry: { originXInches: number; originYInches: number } }>;
  };
  const stored = layout.beds.find((b) => b.name === 'North');
  expect(stored?.geometry.originXInches).toBe(Number(movedX));
  expect(stored?.geometry.originYInches).toBe(Number(movedY));

  await inviteViewer(owner, `planner-place-viewer-${stamp}@example.com`);
  await viewer.goto('/gardens');
  await viewer.getByRole('link', { name: /Place map/ }).click();
  await openOverview(viewer);
  await expect(viewer.getByRole('button', { name: 'Create bed' })).toHaveCount(0);
  await expect(viewer.getByLabel('Search plants')).toHaveCount(0);
});
