import { test, expect, type Locator } from '@playwright/test';
import { newUser, openOverview, openPlantingsFromGarden } from './planner-helpers';

/** Leaf fill + white label. Catches .filters painting primary buttons white. */
async function expectPrimaryPaint(btn: Locator) {
  await expect(btn).toBeVisible();
  await expect(btn).toHaveCSS('background-color', 'rgb(47, 93, 58)');
  await expect(btn).toHaveCSS('color', 'rgb(255, 255, 255)');
}

test('primary actions keep green fill and white label', async ({ page, browser }) => {
  await page.goto('/login');
  await expectPrimaryPaint(page.getByRole('button', { name: 'Login' }));

  const owner = await newUser(browser, `ui-visual-${Date.now()}@example.com`);
  await owner.goto('/gardens');
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Create garden' }));
  await owner.getByPlaceholder('Garden name').fill('Visual');
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await owner.getByRole('link', { name: /Visual/ }).click();
  await openOverview(owner);
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Create bed' }));
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Save layout' }));

  await owner.goto('/plants');
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Apply' }));

  await owner.goto('/gardens');
  await owner.getByRole('link', { name: /Visual/ }).click();
  await openPlantingsFromGarden(owner);
  await expectPrimaryPaint(owner.getByRole('button', { name: 'Search catalog' }));
});
