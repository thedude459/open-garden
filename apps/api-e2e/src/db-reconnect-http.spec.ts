import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { LiveClient, liveEnabled, uniqueEmail } from './live-http';

const databaseUrl = process.env['DATABASE_URL'];
// Terminates the API's database connections, which would break requests from
// other live specs running in parallel. scripts/ci/e2e.sh runs it on its own.
const reconnectEnabled = process.env['E2E_DB_RECONNECT'] === '1';

describe.skipIf(!liveEnabled || !databaseUrl || !reconnectEnabled)('API survives dropped database connections', () => {
  const api = new LiveClient();

  afterAll(() => api.dispose());

  it('answers again after Postgres terminates every API connection', async () => {
    await api.register(uniqueEmail('db-reconnect'));
    expect((await api.get('/api/gardens')).status()).toBe(200);

    const admin = new Client({ connectionString: databaseUrl });
    await admin.connect();
    try {
      // pg_terminate_backend sits in the select list so it only runs on rows
      // that passed the filter; in WHERE, Postgres may call it on every row.
      const killed = await admin.query<{ terminated: boolean }>(
        `select pg_terminate_backend(pid) as terminated from pg_stat_activity
          where application_name = 'open-garden-api' and pid <> pg_backend_pid()`,
      );
      expect(killed.rows.filter((row) => row.terminated).length).toBeGreaterThan(0);
    } finally {
      await admin.end();
    }

    // Idle clients now emit 'error'. Before the pool listener existed this
    // crashed the API process and the request below failed to connect.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect((await api.get('/api/gardens')).status()).toBe(200);
  });
});
