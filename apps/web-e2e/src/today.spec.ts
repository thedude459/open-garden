import { test, expect } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { confirmFixtureAddress, openPlanting } from './planner-helpers';

test('Today is home: it explains itself when empty and completes due tasks', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `today-${Date.now()}@example.com`);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByText('No properties yet')).toBeVisible();

  await page.getByRole('link', { name: 'Add a property' }).click();
  await page.getByPlaceholder('Property name').fill('Today plot');
  await confirmFixtureAddress(page);
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.getByRole('link', { name: /Today plot/ }).click();
  await page.getByRole('link', { name: 'Plantings', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search catalog to add' }).fill('Tomato');
  await page.getByRole('button', { name: 'Search catalog' }).click();
  await page.getByRole('button', { name: 'Add Tomato (Cherry)' }).click();
  const tomato = page.locator('article').filter({ hasText: 'Tomato (Cherry)' }).first();
  await openPlanting(tomato);
  // Planted long ago, so its harvest is overdue.
  await tomato
    .locator('input[type="date"]')
    .first()
    .evaluate((el) => {
      const field = el as HTMLInputElement;
      field.value = '2026-01-01';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' &&
        /\/plantings\/[^/]+$/.test(new URL(r.url()).pathname) &&
        r.ok(),
    ),
    tomato.getByRole('button', { name: 'Save planting' }).click(),
  ]);

  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today plot' })).toBeVisible();
  // Reminders: the e2e server has push keys and no SMTP server.
  const reminders = page.getByRole('region', { name: 'Reminders' });
  await expect(reminders.getByText(/sent once a day, from \d\d:00/)).toBeVisible();
  await expect(
    reminders.getByRole('button', { name: 'Turn on push reminders on this device' }),
  ).toBeVisible();
  await expect(reminders.getByText('Email reminders are not set up on this server.')).toBeVisible();
  const done = page.getByRole('button', { name: 'Done: Harvest Tomato (Cherry)' });
  await expect(done).toBeVisible();
  await done.click();
  await expect(done).toHaveCount(0);

  // The property's Tasks page agrees.
  await page.getByRole('link', { name: 'Today plot' }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  await expect(page.locator('li').filter({ hasText: 'Harvest' })).toHaveCount(0);
});
