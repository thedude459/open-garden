import { test, expect } from '@playwright/test';
import { confirmFixtureAddress, createSizedBed, newUser } from './planner-helpers';

test('a member who picks metric types and reads lengths in metres', async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await newUser(browser, `units-${Date.now()}@example.com`);
  await page.goto('/gardens');

  const units = page.getByLabel('Units');
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/account/units') && r.request().method() === 'PUT',
  );
  await units.selectOption('metric');
  expect((await saved).status()).toBe(204);

  // 20 × 10 ft to start, shown in metres.
  const length = page.getByRole('spinbutton', { name: 'Length (m)' });
  await expect(length).toHaveValue('6.1');
  await page.getByPlaceholder('Property name').fill('Metric plot');
  await length.fill('6');
  await page.getByRole('spinbutton', { name: 'Width (m)' }).fill('3');
  await confirmFixtureAddress(page);
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/gardens') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create property' }).click();
  // Stored in inches on the half-foot grid: 6 m is 19.5 ft.
  const body = (await (await created).json()) as { lengthInches: number; widthInches: number };
  expect(body).toMatchObject({ lengthInches: 234, widthInches: 120 });

  await page.getByRole('link', { name: /Metric plot/ }).click();
  await expect(page.getByRole('heading', { name: 'Garden Overview' })).toBeVisible();
  await createSizedBed(page, 'North', '2.44', '1.22');
  await expect(page.getByText('2.44 × 1.22 m').first()).toBeVisible();

  // Switching back shows the same bed in feet.
  await units.selectOption('imperial');
  await expect(page.getByText('8 × 4 ft').first()).toBeVisible();

  // Temperatures follow the same setting.
  const tomato = await page.request.get('/api/plants?q=Tomato&pageSize=50');
  const items = (
    (await tomato.json()) as {
      items: Array<{ id: string; commonName: string; cultivar: string | null }>;
    }
  ).items;
  const id = items.find((p) => p.commonName === 'Tomato' && !p.cultivar)!.id;
  await page.goto(`/plants/${id}`);
  await expect(page.getByText('50–95 °F')).toBeVisible();
  await expect(page.getByText('61 °F or warmer')).toBeVisible();
  await units.selectOption('metric');
  await expect(page.getByText('10–35 °C')).toBeVisible();
  await expect(page.getByText('16 °C or warmer')).toBeVisible();
});
