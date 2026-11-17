import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('a soil test on a bed gives pH advice for what grows there', async ({ browser }) => {
  const page = await signedInPage(browser, `soil-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Soil plot', place: fixturePlace } })
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
  const planting = { id: crypto.randomUUID() };
  const planted = await page.request.post(`/api/gardens/${garden.id}/plantings`, {
    data: { id: planting.id, plantId: tomato.id, bedId: bed.id },
  });
  expect(planted.status()).toBe(201);
  const placed = await page.request.put(`/api/gardens/${garden.id}/layout`, {
    data: {
      beds: [
        {
          id: bed.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0,
        },
      ],
      placements: [{ plantingId: planting.id, bedId: bed.id, xInches: 24, yInches: 24 }],
    },
  });
  expect(placed.status(), await placed.text()).toBe(200);

  await page.goto(`/gardens/${garden.id}`);
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await page.getByRole('button', { name: 'North', exact: true }).click();
  const soil = page.getByRole('region', { name: 'Soil test of North' });
  await expect(soil.getByText('No test yet.', { exact: false })).toBeVisible();

  await soil.getByRole('button', { name: 'Record a soil test' }).click();
  await soil.getByLabel('Date tested').fill('2026-04-01');
  await soil.getByLabel('Lab', { exact: true }).fill('State lab');
  await soil.getByLabel('pH', { exact: true }).fill('7.2');
  await soil.getByLabel('Organic matter (%)').fill('2.5');
  await soil.getByLabel('Phosphorus (P)').selectOption({ label: 'Low' });
  await soil.getByRole('button', { name: 'Save test' }).click();

  await expect(soil.getByText('Tested Apr 1, 2026 by State lab')).toBeVisible();
  await expect(soil.getByText('pH 7.2 · organic matter 2.5% · Phosphorus low')).toBeVisible();
  await expect(soil.getByText(/^Organic matter is 2\.5%: work in compost/)).toBeVisible();
  // Advice on the plan, not a block: the tomato stays where it is.
  await expect(
    page.getByText(
      'Tomato needs pH 6.0–7.0; this bed tested 7.2: lower it with sulfur over a season',
    ),
  ).toBeVisible();

  await soil.getByRole('button', { name: 'Delete this test' }).click();
  await soil.getByRole('button', { name: 'Confirm delete test' }).click();
  await expect(soil.getByText('No test yet.', { exact: false })).toBeVisible();
  await expect(page.getByText(/Tomato needs pH/)).toHaveCount(0);
});
