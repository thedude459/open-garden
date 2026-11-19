import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('Today warns about frost ahead for tender plants in beds', async ({ browser }) => {
  const page = await signedInPage(browser, `weather-${Date.now()}@example.com`);
  // The fixture forecast has a −2 °C night tomorrow at the Washington address.
  const created = await page.request.post('/api/gardens', {
    data: { name: 'Frost plot', place: fixturePlace },
  });
  const garden = (await created.json()) as { id: string };
  const bed = (await (
    await page.request.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  const plants = (await (await page.request.get('/api/plants?q=Tomato&pageSize=20')).json()) as {
    items: { id: string; commonName: string; cultivar: string | null }[];
  };
  const tomato = plants.items.find((p) => p.commonName === 'Tomato' && !p.cultivar)!;
  const planted = await page.request.post(`/api/gardens/${garden.id}/plantings`, {
    // Planted today: a planned planting is not in the ground, so it gets no alert.
    data: {
      id: crypto.randomUUID(),
      plantId: tomato.id,
      bedId: bed.id,
      plantedOn: new Date().toISOString().slice(0, 10),
    },
  });
  expect(planted.status()).toBe(201);

  await page.goto('/today');
  const weather = page.getByRole('region', { name: 'Weather' });
  await expect(weather.getByText(/^Frost likely \w{3}, \w{3} \d+ \(low 28 °F\)$/)).toBeVisible();
  await expect(weather.getByText('Cover Tomato (North)')).toBeVisible();
  await weather.getByRole('link', { name: 'Frost plot' }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
});
