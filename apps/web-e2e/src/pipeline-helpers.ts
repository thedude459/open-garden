import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

type RunList = { items: Array<{ status: string }> };

async function json(res: APIResponse) {
  return res.json() as Promise<unknown>;
}

export async function waitForPipelineIdle(
  request: APIRequestContext,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get('/api/admin/pipeline/runs?page=1&pageSize=5');
    if (res.ok()) {
      const body = (await json(res)) as RunList;
      if (!body.items.some((item) => item.status === 'running')) return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('timed out waiting for pipeline idle');
}

export async function startPipelineRun(request: APIRequestContext): Promise<APIResponse> {
  for (let attempt = 0; attempt < 15; attempt++) {
    await waitForPipelineIdle(request);
    const res = await request.post('/api/admin/pipeline/runs', { data: {} });
    if (res.status() === 202) return res;
    if (res.status() === 409) continue;
    return res;
  }
  throw new Error('could not start pipeline run');
}

export async function loginAdmin(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', {
    data: { email: 'admin@example.com', password: 'password123' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function waitForPipelineIdleOnPage(page: Page) {
  await waitForPipelineIdle(page.request);
}
