import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { signedInPage } from './session';
import { inviteViewer, openConfiguration, saveGarden } from './planner-helpers';
import { fixturePlace } from './fixture-place';

const WASHINGTON = '1600 Pennsylvania Avenue NW, Washington, DC';
const RAIN_NOTE = "Rain expected — you don't need to water.";

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

async function lookup(page: Page, query: string) {
  await page.getByPlaceholder('Garden address').fill(query);
  await page.getByRole('button', { name: 'Look up address' }).click();
}

test('address lookup, map, and who can see the garden', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await signedInPage(browser, `place-owner-${stamp}@example.com`);
  const viewer = await signedInPage(browser, `place-viewer-${stamp}@example.com`);
  const stranger = await signedInPage(browser, `place-stranger-${stamp}@example.com`);

  await owner.goto('/gardens');
  await owner.getByPlaceholder('Garden name').fill('Mapped garden');
  await lookup(owner, 'Nowhere');
  await expect(owner.getByText('That address could not be found')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create garden' })).toBeDisabled();

  await lookup(owner, 'France');
  await expect(
    owner.getByText('Type a street address. A city, region, or country is not a garden site.'),
  ).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create garden' })).toBeDisabled();

  await lookup(owner, '100 Main Street');
  await expect(owner.getByRole('button', { name: /Springfield, IL/ })).toBeVisible();
  await expect(owner.getByRole('button', { name: /Springfield, MA/ })).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create garden' })).toBeDisabled();

  await lookup(owner, WASHINGTON);
  const map = owner.locator('iframe.garden-map');
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('src', /openstreetmap\.org\/export\/embed\.html/);
  await expect(map).toHaveAttribute('src', /38\.8977/);
  await expect(map).toHaveAttribute('src', /-77\.0365/);
  await expect(map).not.toHaveAttribute('src', /key=/);
  await owner.getByRole('button', { name: 'Create garden' }).click();
  await expect(owner.getByRole('link', { name: /Mapped garden/ })).toBeVisible();

  await owner.getByRole('link', { name: /Mapped garden/ }).click();
  await expect(owner.locator('iframe.garden-map')).toHaveCount(0);
  await openConfiguration(owner);
  await expect(owner.getByText(/1600 Pennsylvania Avenue NW/)).toBeVisible();
  await expect(owner.locator('iframe.garden-map')).toBeVisible();
  await expect(owner.locator('select[name="zone"] option:checked')).toHaveText('Zone 8');

  await owner.locator('select[name="zone"]').selectOption({ label: 'Zone 6' });
  await expect(owner.getByRole('button', { name: 'Save garden' })).toBeEnabled();
  await saveGarden(owner);
  await owner.reload();
  await expect(owner.locator('select[name="zone"] option:checked')).toHaveText('Zone 6');
  await expect(owner.getByText(/1600 Pennsylvania Avenue NW/)).toBeVisible();

  await lookup(owner, '100 Main Street');
  await owner.getByRole('button', { name: /Springfield, IL/ }).click();
  await expect(owner.locator('iframe.garden-map')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Save garden' })).toBeEnabled();
  await saveGarden(owner);
  await expect(
    owner.getByRole('main').getByText(
      'This place was saved. Enter the growing zone and frost dates that could not be determined.',
    ),
  ).toBeVisible();
  await expect(owner.locator('iframe.garden-map')).toBeVisible();

  const gardenId = owner.url().match(/\/gardens\/([^/?#]+)/)?.[1];
  expect(gardenId).toBeTruthy();

  await inviteViewer(owner, `place-viewer-${stamp}@example.com`);
  await viewer.goto(`/gardens/${gardenId}/configure`);
  await expect(viewer.getByText(/100 Main Street, Springfield, IL/)).toBeVisible();
  await expect(viewer.locator('iframe.garden-map')).toBeVisible();
  await expect(viewer.locator('select[name="zone"]')).toBeDisabled();
  await expect(viewer.getByRole('button', { name: 'Look up address' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Save garden' })).toHaveCount(0);

  await stranger.goto(`/gardens/${gardenId}/configure`);
  await expect(stranger.getByText(/not found/i)).toBeVisible();
  await expect(stranger.getByText(/Main Street/)).toHaveCount(0);

  await owner.goto('/gardens');
  await owner.context().route(/openstreetmap\.org\/export\/embed/, (route) => route.abort());
  await owner.reload();
  await owner.getByPlaceholder('Garden name').fill('No map');
  await lookup(owner, WASHINGTON);
  await expect(owner.getByText('The map is unavailable.')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Create garden' })).toBeDisabled();
});

test('rain covers Washington watering and leaves other gardens required', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const owner = await signedInPage(browser, `rain-owner-${stamp}@example.com`);
  const viewer = await signedInPage(browser, `rain-viewer-${stamp}@example.com`);
  const stranger = await signedInPage(browser, `rain-stranger-${stamp}@example.com`);
  const asOf = today();

  const plants = await owner.request.get('/api/plants?q=Interval%20Herb&pageSize=20');
  expect(plants.ok()).toBeTruthy();
  const herb = (
    (await plants.json()) as { items: Array<{ id: string; commonName: string }> }
  ).items.find((item) => item.commonName === 'Interval Herb');
  expect(herb).toBeTruthy();

  async function garden(name: string, place: typeof fixturePlace) {
    const created = await owner.request.post('/api/gardens', { data: { name, place } });
    expect(created.status(), await created.text()).toBe(201);
    return (await created.json()) as { id: string };
  }

  const wet = await garden(`Wet ${stamp}`, fixturePlace);
  const dryPlace = {
    ...fixturePlace,
    formattedAddress: '100 Main Street, Springfield, IL 62701, USA',
    latitude: 39.799,
    longitude: -89.644,
    placeId: 'fixture-main-il',
    postalCode: '62701',
  };
  const dry = await garden(`Dry ${stamp}`, dryPlace);

  for (const id of [wet.id, dry.id]) {
    const planted = await owner.request.post(`/api/gardens/${id}/plantings`, {
      data: { plantId: herb!.id, plantedOn: asOf, startMethod: 'direct_seed' },
    });
    expect(planted.ok(), await planted.text()).toBeTruthy();
  }

  const wetList = await owner.request.get(`/api/gardens/${wet.id}/reminders?asOf=${asOf}`);
  expect(wetList.ok()).toBeTruthy();
  const wetBody = (await wetList.json()) as {
    outlookOn: string | null;
    items: Array<{ kind: string; required: boolean; rainNote: string | null }>;
  };
  expect(wetBody.outlookOn).toBe(asOf);
  expect(wetBody.items.find((item) => item.kind === 'water')).toMatchObject({
    required: false,
    rainNote: RAIN_NOTE,
  });
  expect(wetBody.items.find((item) => item.kind === 'fertilize')).toMatchObject({
    required: true,
    rainNote: null,
  });
  expect(wetBody.items.find((item) => item.kind === 'harvest')).toMatchObject({
    required: true,
    rainNote: null,
  });

  const dryList = await owner.request.get(`/api/gardens/${dry.id}/reminders?asOf=${asOf}`);
  const dryBody = (await dryList.json()) as typeof wetBody;
  expect(dryBody.items.find((item) => item.kind === 'water')).toMatchObject({
    required: true,
    rainNote: null,
  });

  const client = new Client({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://open_garden:open_garden@localhost:5432/open_garden',
  });
  await client.connect();
  await client.query(
    `update gardens set formatted_address = null, latitude = null, longitude = null, place_id = null where id = $1`,
    [dry.id],
  );
  await client.end();
  const bare = await owner.request.get(`/api/gardens/${dry.id}/reminders?asOf=${asOf}`);
  const bareBody = (await bare.json()) as typeof wetBody;
  expect(bareBody.outlookOn).toBeNull();
  expect(bareBody.items.find((item) => item.kind === 'water')?.required).toBe(true);

  await owner.goto(`/gardens/${wet.id}/configure`);
  await inviteViewer(owner, `rain-viewer-${stamp}@example.com`);
  await viewer.goto(`/gardens/${wet.id}/reminders`);
  await expect(viewer.getByText(RAIN_NOTE)).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Complete' })).toHaveCount(0);

  await owner.goto(`/gardens/${wet.id}/reminders`);
  await expect(owner.getByText(RAIN_NOTE)).toBeVisible();
  await expect(owner.locator('li').filter({ hasText: RAIN_NOTE }).getByText('Overdue')).toHaveCount(0);
  await owner.locator('li').filter({ hasText: RAIN_NOTE }).getByRole('button', { name: 'Complete' }).click();
  await expect(owner.getByText(RAIN_NOTE)).toHaveCount(0);

  await stranger.goto(`/gardens/${wet.id}/reminders`);
  await expect(stranger.getByText(/not found/i)).toBeVisible();
  await expect(stranger.getByText(RAIN_NOTE)).toHaveCount(0);
});
