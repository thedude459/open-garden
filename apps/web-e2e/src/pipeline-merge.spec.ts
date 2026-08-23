import { expect, test, type APIRequestContext } from '@playwright/test';
import { loginAdmin, startPipelineRun } from './pipeline-helpers';

async function waitForPlant(request: APIRequestContext, name: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { items: Array<{ commonName: string }> };
    if (body.items.some((item) => item.commonName === name)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for plant ${name}`);
}

test('admin merge of fixture + fixture-b adds uniques and keeps overlap once', async ({
  request,
}) => {
  await loginAdmin(request);
  const patch = await request.patch('/api/admin/pipeline/settings', {
    data: { sourceOrder: ['fixture', 'fixture-b'] },
  });
  expect(patch.ok(), await patch.text()).toBeTruthy();
  const started = await startPipelineRun(request);
  expect(started.status()).toBe(202);
  await waitForPlant(request, 'Pipeline Bravo 01');

  for (let i = 1; i <= 10; i++) {
    const n = String(i).padStart(2, '0');
    const overlap = await request.get(
      `/api/plants?q=${encodeURIComponent(`Pipeline Extra ${n}`)}&pageSize=20`,
    );
    const overlapBody = (await overlap.json()) as { items: Array<{ commonName: string }> };
    expect(
      overlapBody.items.filter((item) => item.commonName === `Pipeline Extra ${n}`),
    ).toHaveLength(1);

    const unique = await request.get(
      `/api/plants?q=${encodeURIComponent(`Pipeline Bravo ${n}`)}&pageSize=20`,
    );
    const uniqueBody = (await unique.json()) as { items: Array<{ commonName: string }> };
    expect(uniqueBody.items.some((item) => item.commonName === `Pipeline Bravo ${n}`)).toBe(true);
  }

  const catalog = await request.get('/api/plants?page=1&pageSize=20');
  const catalogBody = (await catalog.json()) as { totalCount: number };
  expect(catalogBody.totalCount).toBeGreaterThan(30);

  const reset = await request.patch('/api/admin/pipeline/settings', {
    data: { sourceOrder: ['fixture'] },
  });
  expect(reset.ok()).toBeTruthy();
});
