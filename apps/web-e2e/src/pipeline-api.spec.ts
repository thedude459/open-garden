import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { loginAdmin, startPipelineRun, waitForPipelineIdle } from './pipeline-helpers';

type ErrorBody = { error?: { message?: string } };

function errorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    return (body as ErrorBody).error?.message;
  }
  return undefined;
}

async function json(res: APIResponse) {
  return res.json() as Promise<unknown>;
}

async function login(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/login', {
    data: { email, password: 'password123' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe.configure({ mode: 'serial' });

test('unauthenticated pipeline start is 401', async ({ request }) => {
  const res = await request.post('/api/admin/pipeline/runs', { data: {} });
  expect(res.status()).toBe(401);
});

test('gardener POST /api/admin/pipeline/runs is 403 Admin role required', async ({ request }) => {
  await login(request, 'gardener@example.com');
  const res = await request.post('/api/admin/pipeline/runs', { data: {} });
  expect(res.status()).toBe(403);
  expect(errorMessage(await json(res))).toBe('Admin role required');
});

test('admin POST 202 running then GET plants still works', async ({ request }) => {
  await loginAdmin(request);
  const res = await startPipelineRun(request);
  expect(res.status()).toBe(202);
  const body = (await json(res)) as { status: string };
  expect(body.status).toBe('running');
  const plants = await request.get('/api/plants?pageSize=20');
  expect(plants.ok()).toBeTruthy();
});

test('second overlapping POST is 409 already running', async ({ request }) => {
  await loginAdmin(request);
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

test('GET list is newest-first and unknown id is 404', async ({ request }) => {
  await loginAdmin(request);
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
  const missing = await request.get('/api/admin/pipeline/runs/11111111-1111-4111-8111-111111111111');
  expect(missing.status()).toBe(404);
  expect(errorMessage(await json(missing))).toBe('Pipeline run not found');
});

test('gardener GET settings is 403', async ({ request }) => {
  await login(request, 'gardener@example.com');
  const res = await request.get('/api/admin/pipeline/settings');
  expect(res.status()).toBe(403);
  expect(errorMessage(await json(res))).toBe('Admin role required');
});

test('GET run detail includes sources and merges; empty sourceOrder is 400', async ({
  request,
}) => {
  await loginAdmin(request);
  const started = await startPipelineRun(request);
  expect(started.status()).toBe(202);
  const run = (await json(started)) as { id: string };
  let detail: {
    sources: Array<{ sourceId: string }>;
    merges: Array<{ varietyKey: string; fieldWinners: Record<string, string> }>;
    status: string;
  } | null = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await request.get(`/api/admin/pipeline/runs/${run.id}`);
    expect(res.ok()).toBeTruthy();
    detail = (await json(res)) as typeof detail;
    if (detail && detail.status !== 'running') break;
    await new Promise((r) => setTimeout(r, 200));
  }
  expect(detail?.status).not.toBe('running');
  expect(detail?.sources.length).toBeGreaterThan(0);
  expect(detail?.merges.length).toBeGreaterThan(0);
  expect(detail?.merges[0]?.fieldWinners).toBeTruthy();

  const bad = await request.patch('/api/admin/pipeline/settings', { data: { sourceOrder: [] } });
  expect(bad.status()).toBe(400);
  expect(errorMessage(await json(bad))).toBe('Invalid pipeline settings');
});
