import { expect, test } from '@playwright/test';
import { register } from './planner-helpers';

test('20-garden list shows counts within 2s without per-row data GETs', async ({ page }) => {
  await register(page, `list-load-${Date.now()}@example.com`);
  for (let i = 0; i < 20; i++) {
    const res = await page.request.post('/api/gardens', {
      data: { name: `Load garden ${String(i).padStart(2, '0')}` },
    });
    expect(res.status(), await res.text()).toBe(201);
  }

  const extra: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET') return;
    const url = req.url();
    if (url.includes('/layout')) extra.push(url);
    if (/\/api\/gardens\/[0-9a-f-]{36}(\?|$)/i.test(url)) extra.push(url);
  });

  const started = Date.now();
  await page.goto('/gardens');
  const link = page.getByRole('link', { name: /Load garden 00/ });
  await expect(link).toBeVisible({ timeout: 2000 });
  const interactiveMs = Date.now() - started;
  expect(interactiveMs, `garden list interactive_ms=${interactiveMs}`).toBeLessThan(2000);
  await expect(page.getByText(/0 beds/)).toHaveCount(20);
  await expect(page.getByText(/0 placements/)).toHaveCount(20);
  expect(extra, extra.join('\n')).toEqual([]);
});
