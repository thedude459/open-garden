import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage, uniqueEmail } from './session';

test('the plan outlines each area, and a viewer reads each area’s beds and plants', async ({
  browser,
}) => {
  const owner = await signedInPage(browser, uniqueEmail('areas-view-owner'));
  const viewerEmail = uniqueEmail('areas-view-viewer');
  const viewer = await signedInPage(browser, viewerEmail);
  const api = owner.request;
  const garden = (await (
    await api.post('/api/gardens', { data: { name: 'Two areas', place: fixturePlace } })
  ).json()) as { id: string };
  const orchard = (await (
    await api.post(`/api/gardens/${garden.id}/areas`, { data: { kind: 'fruit' } })
  ).json()) as { id: string };
  const north = (await (
    await api.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  const apple = (await (
    await api.post(`/api/gardens/${garden.id}/beds`, {
      data: {
        id: crypto.randomUUID(),
        name: 'Apple',
        lengthInches: 96,
        widthInches: 96,
        areaId: orchard.id,
      },
    })
  ).json()) as { id: string };
  const placed = await api.put(`/api/gardens/${garden.id}/layout`, {
    data: {
      beds: [
        {
          id: north.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0,
        },
        {
          id: apple.id,
          originXInches: 180,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 96,
          orientation: 0,
        },
      ],
      placements: [],
    },
  });
  expect(placed.status(), await placed.text()).toBe(200);
  const plants = (await (await api.get('/api/plants?q=Tomato&pageSize=20')).json()) as {
    items: { id: string; commonName: string; cultivar: string | null }[];
  };
  const tomato = plants.items.find((p) => p.commonName === 'Tomato' && !p.cultivar)!;
  await api.post(`/api/gardens/${garden.id}/plantings`, {
    data: { id: crypto.randomUUID(), plantId: tomato.id, bedId: north.id },
  });
  const invited = await api.post(`/api/gardens/${garden.id}/members`, {
    data: { email: viewerEmail, role: 'viewer' },
  });
  expect(invited.ok(), await invited.text()).toBeTruthy();

  await viewer.goto(`/gardens/${garden.id}`);
  await expect(viewer.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await expect(viewer.locator('[data-outline-of="Vegetable garden"]')).toHaveCount(1);
  await expect(viewer.locator('[data-outline-of="Fruit garden"]')).toHaveCount(1);

  const veg = viewer.getByRole('region', { name: 'Area Vegetable garden' });
  await expect(veg.getByText('1 bed')).toBeVisible();
  await expect(veg.getByText('North: Tomato')).toBeVisible();
  await expect(
    viewer.getByRole('region', { name: 'Area Fruit garden' }).getByText('Apple: nothing planted'),
  ).toBeVisible();
  await expect(veg.getByRole('button')).toHaveCount(0);
  await expect(veg.getByRole('textbox')).toHaveCount(0);
});
