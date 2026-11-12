import { test, expect, type Page } from '@playwright/test';
import { signedInPage as newUser } from './session';
import {
  saveGarden,
  saveLayout,
  openConfiguration,
  openCalendar,
  openOverview,
  confirmFixtureAddress,
  openAdd,
} from './planner-helpers';

// Eight weeks before a 15 April last frost: 19 February in a leap year, else
// the 18th (windows are counted in the season's real year).
const INDOOR_TOMATO = /Indoor Feb 1[89] – Mar 4/;

async function createFrostGarden(page: Page, name: string) {
  await page.goto('/gardens');
  await page.getByPlaceholder('Property name').fill(name);
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
  await openConfiguration(page);
  await page.locator('select[name="zone"]').selectOption({ label: 'Zone 7' });
  await page.locator('select[name="lastMonth"]').selectOption('4');
  await page.locator('input[name="lastDay"]').fill('15');
  await page.locator('select[name="firstMonth"]').selectOption('10');
  await page.locator('input[name="firstDay"]').fill('20');
  await saveGarden(page);
  await page.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Planting calendar' })).toBeVisible();
}

async function addFromCatalog(page: Page, name: string) {
  await page
    .getByRole('textbox', { name: 'Search catalog to add' })
    // Search by common name; a variety reads "Tomato (Cherry)".
    .fill(name.replace(/ \(.*\)$/, ''));
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: `Add ${name}` }).click();
  await expect(page.getByText(name).first()).toBeVisible();
}

test('calendar ranges follow last vs first frost and keep unavailable plants', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const owner = await newUser(browser, `cal-view-owner-${stamp}@example.com`);
  const friend = await newUser(browser, `cal-view-friend-${stamp}@example.com`);

  await createFrostGarden(owner, 'Season bed');
  await addFromCatalog(owner, 'Tomato (Cherry)');
  // Garlic is sown relative to the first fall frost.
  await addFromCatalog(owner, 'Garlic (Music)');
  await openOverview(owner);
  await openAdd(owner, 'Add tree');
  expect((await saveLayout(owner)).ok()).toBeTruthy();
  await owner.locator('nav[aria-label="Garden"]').getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByRole('heading', { name: 'Planting calendar' })).toBeVisible();
  await addFromCatalog(owner, 'Apple (Honeycrisp)');
  await addFromCatalog(owner, 'Radish (Cherry Belle)');

  await expect(owner.getByText(INDOOR_TOMATO)).toBeVisible();
  await expect(owner.getByText(/Sow Oct 6 – Nov 17/)).toBeVisible();
  await expect(
    owner
      .locator('article')
      .filter({ hasText: 'Apple (Honeycrisp)' })
      .getByText(/Indoor unavailable/),
  ).toBeVisible();

  await owner.getByRole('link', { name: 'Settings', exact: true }).click();
  await owner.locator('select[name="lastMonth"]').selectOption('4');
  await owner.locator('input[name="lastDay"]').fill('29');
  await saveGarden(owner);
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByText(/Indoor Mar 4 – Mar 18/)).toBeVisible();
  await expect(owner.getByText(/Sow Oct 6 – Nov 17/)).toBeVisible();

  await owner.getByRole('link', { name: 'Settings', exact: true }).click();
  await owner.locator('select[name="lastMonth"]').selectOption('4');
  await owner.locator('input[name="lastDay"]').fill('15');
  await owner.locator('select[name="firstMonth"]').selectOption('11');
  await owner.locator('input[name="firstDay"]').fill('3');
  await saveGarden(owner);
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByText(INDOOR_TOMATO)).toBeVisible();
  await expect(owner.getByText(/Sow Oct 20 – Dec 1/)).toBeVisible();

  await owner.getByRole('link', { name: 'Settings', exact: true }).click();
  await owner.locator('input[name="inviteEmail"]').fill(`cal-view-friend-${stamp}@example.com`);
  await owner.locator('select[name="inviteRole"]').selectOption('viewer');
  await owner.getByRole('button', { name: 'Invite' }).click();
  await expect(owner.getByText(`cal-view-friend-${stamp}@example.com`)).toBeVisible();

  await friend.goto('/gardens');
  await friend.getByRole('link', { name: /Season bed/ }).click();
  await openCalendar(friend);
  await expect(friend.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Search catalog' })).toHaveCount(0);
  await expect(friend.getByRole('button', { name: /Remove / })).toHaveCount(0);

  await owner.locator('select[name="firstMonth"]').selectOption({ label: 'Month' });
  await owner.locator('input[name="firstDay"]').fill('');
  await saveGarden(owner);
  await owner.getByRole('link', { name: 'Calendar' }).click();
  await expect(owner.getByText(/Windows cannot be produced/)).toBeVisible();
  await expect(owner.locator('article').filter({ hasText: 'Tomato (Cherry)' })).toBeVisible();
});

test('this-week emphasis uses start windows only', async ({ browser }) => {
  const page = await newUser(browser, `cal-week-${Date.now()}@example.com`);
  await page.clock.install({ time: new Date('2026-04-15T15:00:00') });
  await createFrostGarden(page, 'Week bed');
  // Radish is sown from five weeks before to two weeks after the last frost (Apr 15).
  await addFromCatalog(page, 'Radish (Cherry Belle)');
  await addFromCatalog(page, 'Tomato (Cherry)');
  const radish = page.locator('article').filter({ hasText: 'Radish (Cherry Belle)' });
  const tomato = page.locator('article').filter({ hasText: 'Tomato (Cherry)' });
  await expect(radish.getByText('This week')).toBeVisible();
  await expect(tomato.getByText('This week')).toHaveCount(0);
});
