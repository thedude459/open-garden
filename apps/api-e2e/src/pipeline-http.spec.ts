import { describe, expect, test } from 'vitest';
import { liveEnabled, LiveClient, waitUntil } from './live-http';

type ErrorBody = { error?: { message?: string } };
type RunList = { items: Array<{ status: string }> };

function errorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    return (body as ErrorBody).error?.message;
  }
  return undefined;
}

async function json(res: { json: () => Promise<unknown> }) {
  return res.json();
}

async function waitForPipelineIdle(client: LiveClient, timeoutMs = 30_000): Promise<void> {
  await waitUntil(async () => {
    const res = await client.get('/api/admin/pipeline/runs?page=1&pageSize=5');
    if (!res.ok()) return false;
    const body = (await json(res)) as RunList;
    return !body.items.some((item) => item.status === 'running');
  }, timeoutMs, 'timed out waiting for pipeline idle');
}

async function startPipelineRun(client: LiveClient) {
  for (let attempt = 0; attempt < 15; attempt++) {
    await waitForPipelineIdle(client);
    const res = await client.post('/api/admin/pipeline/runs', { data: {} });
    if (res.status() === 202) return res;
    if (res.status() === 409) continue;
    return res;
  }
  throw new Error('could not start pipeline run');
}

async function waitForPlant(client: LiveClient, name: string, timeoutMs = 30_000) {
  await waitUntil(async () => {
    const res = await client.get(`/api/plants?q=${encodeURIComponent(name)}&pageSize=20`);
    if (!res.ok()) return false;
    const body = (await res.json()) as { items: Array<{ commonName: string }> };
    return body.items.some((item) => item.commonName === name);
  }, timeoutMs, `timed out waiting for plant ${name}`);
}

describe.skipIf(!liveEnabled)('pipeline http', () => {
  test('unauthenticated pipeline start is 401', async () => {
    const request = new LiveClient();
    const res = await request.post('/api/admin/pipeline/runs', { data: {} });
    expect(res.status()).toBe(401);
  });

  test('gardener POST /api/admin/pipeline/runs is 403 Admin role required', async () => {
    const request = new LiveClient();
    await request.register(`pipe-gardener-${Date.now()}@example.com`);
    const res = await request.post('/api/admin/pipeline/runs', { data: {} });
    expect(res.status()).toBe(403);
    expect(errorMessage(await json(res))).toBe('Admin role required');
  });

  test('admin POST 202 running then GET plants still works', async () => {
    const request = new LiveClient();
    await request.login('admin@example.com');
    const res = await startPipelineRun(request);
    expect(res.status()).toBe(202);
    const body = (await json(res)) as { status: string };
    expect(body.status).toBe('running');
    const plants = await request.get('/api/plants?pageSize=20');
    expect(plants.ok()).toBeTruthy();
  });

  test('second overlapping POST is 409 already running', async () => {
    const request = new LiveClient();
    await request.login('admin@example.com');
    await waitForPipelineIdle(request);
    const [a, b] = await Promise.all([
      request.post('/api/admin/pipeline/runs', { data: {} }),
      request.post('/api/admin/pipeline/runs', { data: {} }),
    ]);
    const statuses = [a.status(), b.status()].sort((x, y) => x - y);
    expect(statuses).toEqual([202, 409]);
    const conflict = a.status() === 409 ? a : b;
    expect(errorMessage(await json(conflict))).toBe('A pipeline run is already running');
  });

  test('GET list is newest-first and unknown id is 404', async () => {
    const request = new LiveClient();
    await request.login('admin@example.com');
    await startPipelineRun(request);
    const listRes = await request.get('/api/admin/pipeline/runs?page=1&pageSize=20');
    expect(listRes.ok()).toBeTruthy();
    const list = (await json(listRes)) as {
      items: Array<{ id: string; startedAt: string }>;
      totalCount: number;
    };
    expect(list.totalCount).toBeGreaterThan(0);
    if (list.items.length >= 2) {
      expect(Date.parse(list.items[0]!.startedAt)).toBeGreaterThanOrEqual(
        Date.parse(list.items[1]!.startedAt),
      );
    }
    const missing = await request.get(
      '/api/admin/pipeline/runs/11111111-1111-4111-8111-111111111111',
    );
    expect(missing.status()).toBe(404);
    expect(errorMessage(await json(missing))).toBe('Pipeline run not found');
  });

  test('gardener GET settings is 403', async () => {
    const request = new LiveClient();
    await request.register(`pipe-settings-${Date.now()}@example.com`);
    const res = await request.get('/api/admin/pipeline/settings');
    expect(res.status()).toBe(403);
    expect(errorMessage(await json(res))).toBe('Admin role required');
  });

  test('GET run detail includes sources and merges; empty sourceOrder is 400', async () => {
    const request = new LiveClient();
    await request.login('admin@example.com');
    const started = await startPipelineRun(request);
    expect(started.status()).toBe(202);
    const run = (await json(started)) as { id: string };
    let detail: {
      sources: Array<{ sourceId: string }>;
      merges: Array<{ varietyKey: string; fieldWinners: Record<string, string> }>;
      status: string;
    } | null = null;
    await waitUntil(async () => {
      const res = await request.get(`/api/admin/pipeline/runs/${run.id}`);
      if (!res.ok()) return false;
      detail = (await json(res)) as typeof detail;
      return Boolean(detail && detail.status !== 'running');
    }, 30_000, 'timed out waiting for pipeline run detail');
    expect(detail?.status).not.toBe('running');
    expect(detail?.sources.length).toBeGreaterThan(0);
    expect(detail?.merges.length).toBeGreaterThan(0);
    expect(detail?.merges[0]?.fieldWinners).toBeTruthy();

    const bad = await request.patch('/api/admin/pipeline/settings', { data: { sourceOrder: [] } });
    expect(bad.status()).toBe(400);
    expect(errorMessage(await json(bad))).toBe('Invalid pipeline settings');
  });

  test('admin merge of fixture + fixture-b adds uniques and keeps overlap once', async () => {
    const request = new LiveClient();
    await request.login('admin@example.com');
    try {
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
        expect(uniqueBody.items.some((item) => item.commonName === `Pipeline Bravo ${n}`)).toBe(
          true,
        );
      }
    } finally {
      const reset = await request.patch('/api/admin/pipeline/settings', {
        data: { sourceOrder: ['fixture'] },
      });
      expect(reset.ok()).toBeTruthy();
    }
  });
});
