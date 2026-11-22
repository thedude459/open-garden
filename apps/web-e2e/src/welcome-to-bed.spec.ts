import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('crops picked on the welcome page are offered in Bed View and dragged into a bed (ADR 0040)', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `welcome-bed-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Welcome plot', place: fixturePlace } })
  ).json()) as { id: string };

  await page.goto(`/gardens/${garden.id}/welcome`);
  const tomato = page.locator('.starter-list label').filter({ hasText: /^\s*Tomato\b/ });
  await tomato.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Add 1 to the calendar/ }).click();
  await expect(tomato.getByText('on the calendar')).toBeVisible();
  await page.getByRole('button', { name: /Add (a )?(first )?bed/i }).click();
  await expect(page.getByText(/is on the plan/)).toBeVisible();

  await page.getByRole('link', { name: 'Go to the plan' }).click();
  await page
    .getByRole('button', { name: /^Open bed / })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  const planned = page.getByRole('region', { name: 'Planned, not in a bed' });
  await planned.getByRole('button', { name: 'Tomato' }).dragTo(page.locator('[data-bed-name]'));
  await expect(page.getByRole('img', { name: 'Tomato, planned' })).toBeVisible();
  await expect(planned).toHaveCount(0);
  await expect(page.getByText('All changes saved')).toBeVisible();

  // The calendar still lists it, planned.
  await page.goto(`/gardens/${garden.id}/calendar`);
  const row = page.locator('article').filter({ hasText: 'Tomato' });
  await expect(row.getByText('Planned', { exact: true })).toBeVisible();
});
