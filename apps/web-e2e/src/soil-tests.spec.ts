import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('an area’s soil test gives pH advice, and a bed’s own test overrides it', async ({
  browser,
}) => {
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
  const note = page.getByText(
    'Tomato needs pH 6.0–7.0; the soil here tested 7.2: lower it with sulfur over a season',
  );

  // One test of the whole vegetable garden covers its beds.
  const area = page.getByRole('region', { name: 'Soil test of Vegetable garden' });
  await area.getByRole('button', { name: 'Record a soil test' }).click();
  await area.getByLabel('Date tested').fill('2026-04-01');
  await area.getByLabel('Lab', { exact: true }).fill('State lab');
  await area.getByLabel('pH', { exact: true }).fill('7.2');
  await area.getByLabel('Organic matter (%)').fill('2.5');
  await area.getByLabel('Phosphorus (P)').selectOption({ label: 'Low' });
  await area.getByRole('button', { name: 'Save test' }).click();
  await expect(area.getByText('Tested Apr 1, 2026 by State lab')).toBeVisible();
  await expect(area.getByText('pH 7.2 · organic matter 2.5% · Phosphorus low')).toBeVisible();
  await expect(area.getByText(/^Organic matter is 2\.5%: work in compost/)).toBeVisible();
  // Advice on the plan, not a block: the tomato stays where it is.
  await expect(note).toBeVisible();

  // A bed whose soil differs takes its own test, which wins.
  await page.getByRole('button', { name: 'North', exact: true }).click();
  const bedSoil = page.getByRole('region', { name: 'Soil test of North' });
  await expect(bedSoil.getByText(/^The Vegetable garden test applies:/)).toBeVisible();
  await bedSoil.getByRole('button', { name: 'Record a soil test' }).click();
  await bedSoil.getByLabel('Date tested').fill('2026-05-01');
  await bedSoil.getByLabel('pH', { exact: true }).fill('6.5');
  await bedSoil.getByRole('button', { name: 'Save test' }).click();
  await expect(bedSoil.getByText('pH 6.5')).toBeVisible();
  await expect(note).toHaveCount(0);

  // Bed View shows the test that applies to the bed.
  await page.goto(`/gardens/${garden.id}/layout/beds/${bed.id}`);
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible();
  await expect(bedSoil.getByText('pH 6.5')).toBeVisible();
  await page.goto(`/gardens/${garden.id}`);
  await page.getByRole('button', { name: 'North', exact: true }).click();

  await bedSoil.getByRole('button', { name: 'Delete this test' }).click();
  await bedSoil.getByRole('button', { name: 'Confirm delete test' }).click();
  await expect(bedSoil.getByText(/^The Vegetable garden test applies:/)).toBeVisible();
  await expect(note).toBeVisible();
  await page.goto(`/gardens/${garden.id}/layout/beds/${bed.id}`);
  await expect(bedSoil.getByText(/^The Vegetable garden test applies:.*pH 7\.2/)).toBeVisible();
});
