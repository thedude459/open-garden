import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('watering a tomato in a bed says how far the soil is short', async ({ browser }) => {
  const page = await signedInPage(browser, `water-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Water plot', place: fixturePlace } })
  ).json()) as { id: string };
  const bed = (await (
    await page.request.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  const plants = (await (await page.request.get('/api/plants?q=Tomato&pageSize=20')).json()) as {
    items: { id: string; commonName: string; cultivar: string | null }[];
  };
  const tomato = plants.items.find((p) => p.commonName === 'Tomato' && !p.cultivar)!;
  const planted = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
  const res = await page.request.post(`/api/gardens/${garden.id}/plantings`, {
    data: { id: crypto.randomUUID(), plantId: tomato.id, bedId: bed.id, plantedOn: planted },
  });
  expect(res.status(), await res.text()).toBe(201);

  await page.goto(`/gardens/${garden.id}/reminders`);
  // 26 mm in the fixture's weather, shown in inches for this member.
  await expect(page.getByText('Soil about 1.0 in short of water')).toBeVisible();
  await page.getByRole('button', { name: 'Complete' }).first().click();
  await expect(page.getByText('Soil about 1.0 in short of water')).toHaveCount(0);
});
