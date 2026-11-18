import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { confirmFixtureAddress } from './planner-helpers';
import { signedInPage } from './session';

/** Serious and critical WCAG 2.1 A and AA problems on the page as it stands. */
async function problems(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The OpenStreetMap embed is another site's page.
    .exclude('iframe.garden-map')
    .analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

test('the sign-in and password reset pages have no serious accessibility problems', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  expect(await problems(page)).toEqual([]);
  await page.goto('/forgot-password');
  await expect(page.getByRole('button', { name: 'Email me a link' })).toBeVisible();
  expect(await problems(page)).toEqual([]);
  await page.goto(`/reset-password?token=${'0'.repeat(64)}`);
  await expect(page.getByRole('button', { name: 'Set password' })).toBeVisible();
  expect(await problems(page)).toEqual([]);
});

test('the main pages have no serious accessibility problems', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await signedInPage(browser, `a11y-${Date.now()}@example.com`);
  await page.getByPlaceholder('Property name').fill('Access plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await expect(page.getByRole('link', { name: /Access plot/ })).toBeVisible();
  const found: Record<string, string[]> = {};
  const scan = async (name: string, path: string, ready: () => Promise<void>) => {
    await page.goto(path);
    await ready();
    found[name] = await problems(page);
  };
  const id = (page.url().match(/gardens\/([^/]+)/) ?? [])[1];
  const gardenId =
    id ??
    (await page.getByRole('link', { name: /Access plot/ }).getAttribute('href'))!.split('/')[2]!;
  const heading = (name: string | RegExp) => () =>
    expect(page.getByRole('heading', { name }).first()).toBeVisible();

  await scan('properties', '/gardens', heading('Properties'));
  await scan('today', '/today', heading(/Today/));
  await scan('catalog', '/plants', heading('Plant catalog'));
  // A busy button (a search under way) must keep its label readable too.
  await page
    .getByRole('button', { name: 'Apply' })
    .evaluate((b) => b.setAttribute('aria-busy', 'true'));
  found['catalog busy'] = await problems(page);
  await page.getByPlaceholder('Search name / species / variety').fill('Tomato');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: /Tomato \(Cherry\)/ }).click();
  await heading('When to sow')();
  found['plant'] = await problems(page);
  await scan('favorites', '/favorites', heading(/Favorites/));
  await scan('account', '/account', heading('Account'));
  await scan('setup', `/gardens/${gardenId}/welcome`, heading(/Set up/));
  // A bed on the plan, so the plan and Bed View are scanned with something drawn.
  await page.getByRole('button', { name: 'Add bed' }).click();
  await expect(page.getByText('Bed 1 is on the plan.')).toBeVisible();
  await scan('plan', `/gardens/${gardenId}/layout`, heading('Garden Overview'));
  const layout = (await (await page.request.get(`/api/gardens/${gardenId}/layout`)).json()) as {
    beds: { id: string }[];
  };
  await scan(
    'bed view',
    `/gardens/${gardenId}/layout/beds/${layout.beds[0]!.id}`,
    heading('Bed View'),
  );
  await scan('plantings', `/gardens/${gardenId}/plantings`, heading(/Plantings/));
  await scan('harvests', `/gardens/${gardenId}/harvests`, heading('Harvests'));
  await scan('calendar', `/gardens/${gardenId}/calendar`, heading('Planting calendar'));
  await scan('transplants', `/gardens/${gardenId}/transplants`, heading(/Transplants/));
  await scan('tasks', `/gardens/${gardenId}/reminders`, heading(/Tasks|Reminders/));
  // Placing a plant with the keyboard alone: choose it, then Enter on the plan.
  await page.goto(`/gardens/${gardenId}/layout/beds/${layout.beds[0]!.id}`);
  await page.getByLabel('Search plants').fill('Radish');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Place Radish (Cherry Belle)' }).focus();
  await page.keyboard.press('Enter');
  const plan = page.getByRole('img', { name: /press Enter to place Radish \(Cherry Belle\)/ });
  await expect(plan).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.locator('og-bed-plantings-list').getByText('Radish (Cherry Belle)'),
  ).toBeVisible();

  await scan('settings', `/gardens/${gardenId}/configure`, heading('Property'));

  expect(found).toEqual(Object.fromEntries(Object.keys(found).map((k) => [k, []])));
});
