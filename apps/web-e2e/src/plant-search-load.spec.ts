import { fixturePlace } from './fixture-place';
import { expect, test } from '@playwright/test';
import { signedInPage } from './session';

test('plant search shows stand-ins within 2s without per-result plant GETs', async ({
  browser,
}) => {
  const page = await signedInPage(browser, `search-load-${Date.now()}@example.com`);
  const extra: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET') return;
    const url = req.url();
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)) return;
    if (/\/api\/plants\/[0-9a-f-]{36}(\?|$)/i.test(url)) extra.push(url);
  });

  const started = Date.now();
  await page.goto('/plants');
  await expect(page.getByRole('heading', { name: 'Plant catalog' })).toBeVisible();
  await page.getByPlaceholder(/Search name/).fill('a');
  await page.getByRole('button', { name: 'Apply' }).click();
  const rows = page.locator('.card-list a.row');
  await expect(rows.first()).toBeVisible({ timeout: 2000 });
  const interactiveMs = Date.now() - started;
  expect(interactiveMs, `plants search interactive_ms=${interactiveMs}`).toBeLessThan(2000);
  expect(await rows.count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.card-list .plant-icon img')).toHaveCount(await rows.count());
  expect(extra, extra.join('\n')).toEqual([]);

  const created = await page.request.post('/api/gardens', {
    data: { place: fixturePlace, name: 'Search panel' },
  });
  expect(created.status()).toBe(201);
  const garden = (await created.json()) as { id: string };
  const bedRes = await page.request.post(`/api/gardens/${garden.id}/beds`, {
    data: { id: crypto.randomUUID(), name: 'Panel bed', lengthInches: 96, widthInches: 48 },
  });
  expect(bedRes.status()).toBe(201);
  const bed = (await bedRes.json()) as { id: string };
  extra.length = 0;
  // Two budgets, as ADR 0013 sets them: Bed View is interactive within 2 s,
  // and a search there shows results within 2 s. Timing them as one sum
  // (load, typing, and search) failed on a busy runner (#212).
  const panelStart = Date.now();
  await page.goto(`/gardens/${garden.id}/layout/beds/${bed.id}`);
  const search = page.getByLabel('Search plants');
  await expect(search).toBeEditable({ timeout: 2000 });
  const panelMs = Date.now() - panelStart;
  await search.fill('a');
  const searchStart = Date.now();
  await page.getByRole('button', { name: 'Apply' }).click();
  const hits = page.locator('.plant-panel-list .row');
  await expect(hits.first()).toBeVisible({ timeout: 2000 });
  const searchMs = Date.now() - searchStart;
  test.info().annotations.push({
    type: 'timing',
    description: `bed panel ${panelMs} ms, search ${searchMs} ms`,
  });
  expect(panelMs, `bed panel interactive_ms=${panelMs}`).toBeLessThan(2000);
  expect(searchMs, `bed panel search_ms=${searchMs}`).toBeLessThan(2000);
  expect(await hits.count()).toBeGreaterThanOrEqual(10);
  expect(extra, extra.join('\n')).toEqual([]);
});
