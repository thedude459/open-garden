import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('a crop picked for next season is planned for its next sowing window (ADR 0040)', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `plan-date-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Dated plot', place: fixturePlace } })
  ).json()) as { id: string };
  const plants = (await (await page.request.get('/api/plants?q=Lettuce&pageSize=20')).json()) as {
    items: { id: string; commonName: string; cultivar: string | null }[];
  };
  const lettuce = plants.items.find((p) => p.commonName === 'Lettuce' && !p.cultivar)!;
  const next = new Date().getFullYear() + 1;
  const added = await page.request.post(`/api/gardens/${garden.id}/calendar`, {
    data: { plantId: lettuce.id, seasonYear: next },
  });
  expect(added.status(), await added.text()).toBe(201);

  await page.goto(`/gardens/${garden.id}/calendar`);
  await page.getByLabel('Season').selectOption({ label: `${next} (planning)` });
  const row = page.locator('article').filter({ hasText: 'Lettuce' });
  const planFor = row.getByRole('button', { name: /^Plan Lettuce for / });
  await expect(planFor).toBeVisible();
  await planFor.click();
  await expect(planFor).toHaveCount(0);

  const listed = (await (
    await page.request.get(`/api/gardens/${garden.id}/plantings?season=${next}`)
  ).json()) as { plantings: { plantId: string; plannedOn: string | null }[] };
  const planned = listed.plantings.find((p) => p.plantId === lettuce.id)!;
  // Next spring's sowing window at the test address (last frost Apr 15).
  expect(planned.plannedOn).toMatch(new RegExp(`^${next}-0[2-5]-\\d{2}$`));
});
