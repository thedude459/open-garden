import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

/** A day `days` from today in the browser's time zone, as YYYY-MM-DD. */
function dayFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
}

test('a planned planting has only a Sow task until it is marked planted (ADR 0040)', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `planned-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Plan plot', place: fixturePlace } })
  ).json()) as { id: string };
  const bed = (await (
    await page.request.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  const plants = (await (await page.request.get('/api/plants?q=Lettuce&pageSize=20')).json()) as {
    items: { id: string; commonName: string; cultivar: string | null }[];
  };
  const lettuce = plants.items.find((p) => p.commonName === 'Lettuce' && !p.cultivar)!;
  const plantingId = crypto.randomUUID();
  const plannedOn = dayFromToday(7);
  const created = await page.request.post(`/api/gardens/${garden.id}/plantings`, {
    data: { id: plantingId, plantId: lettuce.id, bedId: bed.id, plannedOn },
  });
  expect(created.status(), await created.text()).toBe(201);
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
      placements: [{ plantingId, bedId: bed.id, xInches: 24, yInches: 24 }],
    },
  });
  expect(placed.status(), await placed.text()).toBe(200);

  const tasks = async () => {
    await page.goto(`/gardens/${garden.id}/reminders`);
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
    return page.locator('li.row').filter({ hasText: 'Lettuce' });
  };
  const badge = (name: string) => page.locator('.badge', { hasText: new RegExp(`^${name}$`) });

  // Planned: sow it, and nothing else yet.
  let lettuceTasks = await tasks();
  await expect(lettuceTasks.filter({ has: badge('Sow') })).toHaveCount(1);
  await expect(lettuceTasks.filter({ has: badge('Harvest') })).toHaveCount(0);

  // Bed View draws it as an outline and offers Mark planted.
  await page.goto(`/gardens/${garden.id}/layout/beds/${bed.id}`);
  await expect(page.getByRole('img', { name: 'Lettuce, planned' })).toBeVisible();
  await expect(page.getByText(/^Lettuce · planned for/)).toBeVisible();
  await page.getByRole('button', { name: 'Mark Lettuce planted today' }).click();
  await expect(page.getByText('Lettuce planted')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Lettuce', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Lettuce planted today' })).toHaveCount(0);

  // Planted: the Sow task is gone, and care counts from today.
  lettuceTasks = await tasks();
  await expect(lettuceTasks.filter({ has: badge('Sow') })).toHaveCount(0);
  await expect(lettuceTasks.filter({ has: badge('Harvest') })).toHaveCount(1);
  const listed = (await (await page.request.get(`/api/gardens/${garden.id}/plantings`)).json()) as {
    plantings: { id: string; plannedOn: string | null; plantedOn: string | null }[];
  };
  expect(listed.plantings.find((p) => p.id === plantingId)).toMatchObject({
    plannedOn,
    plantedOn: dayFromToday(0),
  });
});
