import { expect, test, type APIRequestContext } from '@playwright/test';
import { signedInPage } from './session';

async function findPlant(request: APIRequestContext, name: string) {
  const res = await request.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    items: Array<{ id: string; commonName: string }>;
  };
  const plant = body.items.find((p) => p.commonName === name) ?? body.items[0];
  expect(plant, `missing plant ${name}`).toBeTruthy();
  return plant!;
}

test('100-placement overview and bed view are interactive within 2s without per-planting plant GETs', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await signedInPage(browser, `planner-load-${Date.now()}@example.com`);
  const created = await page.request.post('/api/gardens', { data: { name: 'Load planner' } });
  expect(created.status()).toBe(201);
  const garden = (await created.json()) as { id: string };
  const bedRes = await page.request.post(`/api/gardens/${garden.id}/beds`, {
    data: { id: crypto.randomUUID(), name: 'Load bed', lengthInches: 240, widthInches: 240 },
  });
  expect(bedRes.status(), await bedRes.text()).toBe(201);
  const bed = (await bedRes.json()) as { id: string };
  const plant = await findPlant(page.request, 'Basil');

  const placements: Array<{ plantingId: string; bedId: string; xInches: number; yInches: number }> =
    [];
  for (let batch = 0; batch < 10; batch++) {
    const created = await Promise.all(
      Array.from({ length: 10 }, async (_, j) => {
        const i = batch * 10 + j;
        const plantingId = crypto.randomUUID();
        const add = await page.request.post(`/api/gardens/${garden.id}/plantings`, {
          data: { id: plantingId, plantId: plant.id },
        });
        expect(add.status(), await add.text()).toBe(201);
        return { plantingId, i };
      }),
    );
    for (const { plantingId, i } of created) {
      placements.push({
        plantingId,
        bedId: bed.id,
        xInches: 12 + (i % 10) * 18,
        yInches: 12 + Math.floor(i / 10) * 18,
      });
    }
  }

  const put = await page.request.put(`/api/gardens/${garden.id}/layout`, {
    data: {
      beds: [
        {
          id: bed.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 240,
          widthInches: 240,
          orientation: 0,
        },
      ],
      areas: [],
      placements,
    },
  });
  expect(put.ok(), await put.text()).toBeTruthy();

  const extra: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET') return;
    if (/\/api\/plants\/[0-9a-f-]{36}(\?|$)/i.test(req.url())) extra.push(req.url());
  });

  const overviewStart = Date.now();
  await page.goto(`/gardens/${garden.id}/layout`);
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible({
    timeout: 2000,
  });
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled({ timeout: 2000 });
  const overviewMs = Date.now() - overviewStart;
  expect(overviewMs, `overview interactive_ms=${overviewMs}`).toBeLessThan(2000);

  const bedStart = Date.now();
  await page.goto(`/gardens/${garden.id}/layout/beds/${bed.id}`);
  await expect(page.getByRole('heading', { name: 'Bed View' })).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled({ timeout: 2000 });
  const bedMs = Date.now() - bedStart;
  expect(bedMs, `bed view interactive_ms=${bedMs}`).toBeLessThan(2000);
  expect(extra, extra.join('\n')).toEqual([]);
});
