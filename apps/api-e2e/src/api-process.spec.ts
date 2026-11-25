import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { liveEnabled, waitUntil } from './live-http';

// The bundle the Docker image ships; scripts/ci/e2e.sh builds it.
const MAIN = 'dist/api-runtime/main.js';
const PORT = 3901;
const ORIGIN = `http://localhost:${PORT}`;
// Starting a second API slows the other live specs, so scripts/ci/e2e.sh runs
// these on their own after them.
const runnable =
  liveEnabled &&
  process.env['E2E_ALONE'] === '1' &&
  Boolean(process.env['DATABASE_URL']) &&
  existsSync(MAIN);

/** A second API from the shipped bundle, with everything it prints. */
async function startApi() {
  const api = spawn(process.execPath, [MAIN], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(api);
  let output = '';
  api.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  api.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<number>((resolve) => api.on('exit', () => resolve(Date.now())));
  await waitUntil(
    async () => (await fetch(`${ORIGIN}/api/health`).catch(() => null))?.ok ?? false,
    30_000,
    'second API did not start',
  );
  return { api, exited, output: () => output };
}

const started: ChildProcess[] = [];

describe.skipIf(!runnable)('the API process', () => {
  afterEach(() => {
    for (const api of started.splice(0)) {
      if (api.exitCode === null && api.signalCode === null) api.kill('SIGKILL');
    }
  });

  /**
   * Docker stops the API with SIGTERM and kills it 10 seconds later. The API
   * must finish on its own well before then, closing its database pool.
   */
  test('SIGTERM closes the database pool and exits', async () => {
    const { api, exited, output } = await startApi();
    const stoppedAt = Date.now();
    api.kill('SIGTERM');
    const tookMs = (await exited) - stoppedAt;
    expect(output()).toContain('database.pool_closed signal=SIGTERM');
    expect(tookMs).toBeLessThan(5_000);
  }, 45_000);

  test('logs each request with its id, and a failed sign-in as a security event', async () => {
    const { output } = await startApi();
    const email = `log-check-${Date.now()}@example.com`;
    const res = await fetch(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'live-check-1' },
      body: JSON.stringify({ email, password: 'not-the-password' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('x-request-id')).toBe('live-check-1');
    await waitUntil(async () => output().includes('id=live-check-1'), 5_000, 'no request line');
    expect(output()).toMatch(
      /request method=POST path=\/api\/auth\/login status=401 ms=\d+ id=live-check-1/,
    );
    expect(output()).toMatch(/security\.sign_in_failed account=[0-9a-f]{12} ip=\S+/);
    expect(output()).not.toContain(email);
    expect(output()).not.toContain('not-the-password');
  }, 45_000);
});
