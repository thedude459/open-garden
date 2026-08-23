import { test, expect } from '@playwright/test';
import { createSizedBed, newUser, openOverview } from './planner-helpers';

test('primary names stay visible after button class changes', async ({ page, browser }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();

  const owner = await newUser(browser, `ui-visual-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await expect(owner.getByRole('button', { name: 'Create garden' })).toBeVisible();
  await owner.getByPlaceholder('Garden name').fill('Visual');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Visual/ }).click();
  await openOverview(owner);
  await createSizedBed(owner, 'North');
  await expect(owner.getByRole('button', { name: 'Save layout' })).toBeVisible();
});
