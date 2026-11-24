import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { liveEnabled, waitUntil } from './live-http';

// The bundle the Docker image ships; scripts/ci/e2e.sh builds it.
const MAIN = 'dist/api-runtime/main.js';
const PORT = 3901;
// Starting a second API slows the other live specs, so scripts/ci/e2e.sh runs
// this one on its own after them.
const runnable =
  liveEnabled &&
  process.env['E2E_ALONE'] === '1' &&
  Boolean(process.env['DATABASE_URL']) &&
  existsSync(MAIN);

/**
 * Docker stops the API with SIGTERM and kills it 10 seconds later. The API
 * must finish on its own well before then, closing its database pool.
 */
describe.skipIf(!runnable)('stopping the API', () => {
  test('SIGTERM closes the database pool and exits', async () => {
    const api = spawn(process.execPath, [MAIN], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    api.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    api.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const exited = new Promise<number>((resolve) => api.on('exit', () => resolve(Date.now())));
    try {
      await waitUntil(
        async () =>
          (await fetch(`http://localhost:${PORT}/api/health`).catch(() => null))?.ok ?? false,
        30_000,
        'second API did not start',
      );
      const stoppedAt = Date.now();
      api.kill('SIGTERM');
      const tookMs = (await exited) - stoppedAt;
      expect(output).toContain('database.pool_closed signal=SIGTERM');
      expect(tookMs).toBeLessThan(5_000);
    } finally {
      if (api.exitCode === null && api.signalCode === null) api.kill('SIGKILL');
    }
  }, 45_000);
});
