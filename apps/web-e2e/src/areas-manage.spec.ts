import { expect, test } from '@playwright/test';
import { fixturePlace } from './fixture-place';
import { signedInPage } from './session';

test('an area is renamed, a bed moves to another area, and the emptied area is deleted', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `areas-${Date.now()}@example.com`);
  const garden = (await (
    await page.request.post('/api/gardens', { data: { name: 'Areas plot', place: fixturePlace } })
  ).json()) as { id: string };
  const bed = (await (
    await page.request.post(`/api/gardens/${garden.id}/beds`, {
      data: { id: crypto.randomUUID(), name: 'North', lengthInches: 96, widthInches: 48 },
    })
  ).json()) as { id: string };
  await page.request.put(`/api/gardens/${garden.id}/layout`, {
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
      placements: [],
    },
  });
  await page.request.post(`/api/gardens/${garden.id}/areas`, { data: { kind: 'vegetable' } });

  await page.goto(`/gardens/${garden.id}`);
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();

  const second = page.getByRole('region', { name: 'Area Vegetable garden 2' });
  await second.getByRole('textbox', { name: 'Name' }).fill('Back garden');
  await second.getByRole('button', { name: 'Rename Vegetable garden 2' }).click();
  const back = page.getByRole('region', { name: 'Area Back garden' });
  await expect(back).toBeVisible();
  await expect(back.getByText('No beds yet')).toBeVisible();

  await page.getByRole('button', { name: 'North', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Area', exact: true })
    .selectOption({ label: 'Back garden' });
  await expect(page.getByText('North moved to Back garden')).toBeVisible();
  await expect(back.getByText('1 bed')).toBeVisible();

  const first = page.getByRole('region', { name: 'Area Vegetable garden' });
  await expect(first.getByText('No beds yet')).toBeVisible();
  await first.getByRole('button', { name: 'Delete area Vegetable garden' }).click();
  await first.getByRole('button', { name: 'Confirm delete area Vegetable garden' }).click();
  await expect(page.getByText('Vegetable garden deleted')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Area Vegetable garden' })).toHaveCount(0);
  await expect(back.getByRole('button', { name: 'Delete area Back garden' })).toHaveCount(0);
});
