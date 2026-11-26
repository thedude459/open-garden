import { test, expect } from '@playwright/test';
import { signedInPage as newUser } from './session';
import { fixturePlace } from './fixture-place';

test('a bed’s weekly Scout task names its pests on Today and the Tasks page', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const page = await newUser(browser, `scout-${Date.now()}@example.com`);
  // Set up through the member's own session: a US property, a bed, potatoes planted today.
  const api = page.context().request;
  const garden = (await (
    await api.post('/api/gardens', { data: { name: 'Scout plot', place: fixturePlace } })
  ).json()) as { id: string };
  const bed = (await (
    await api.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  const { items } = (await (await api.get('/api/plants?q=Potato&pageSize=20')).json()) as {
    items: Array<{ id: string; commonName: string; cultivar: string | null }>;
  };
  const potato = items.find((p) => p.commonName === 'Potato' && !p.cultivar)!;
  const id = crypto.randomUUID();
  expect(
    (
      await api.post(`/api/gardens/${garden.id}/plantings`, {
        data: { id, plantId: potato.id, bedId: bed.id },
      })
    ).status(),
  ).toBe(201);
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  expect(
    (
      await api.patch(`/api/gardens/${garden.id}/plantings/${id}`, { data: { plantedOn: today } })
    ).ok(),
  ).toBe(true);

  await page.goto('/gardens');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scout plot' })).toBeVisible();
  const done = page.getByRole('button', {
    name: 'Done: Scout for Aphids, Colorado potato beetle, Flea beetles',
  });
  await expect(done).toBeVisible();

  // The property's Tasks page lists it under its bed.
  await page.goto(`/gardens/${garden.id}`);
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  const scout = page.locator('li').filter({ hasText: 'Scout' });
  await expect(scout).toContainText('Aphids, Colorado potato beetle, Flea beetles');
  await scout.getByRole('button', { name: 'Complete' }).click();
  // Done for this week: next week's is upcoming.
  await expect(scout).toContainText('Upcoming');
});
