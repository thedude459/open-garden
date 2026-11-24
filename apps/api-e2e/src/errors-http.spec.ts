import { describe, expect, test } from 'vitest';
import { API_ORIGIN, liveEnabled, LiveClient, uniqueEmail } from './live-http';

type ErrorBody = { error: { code: string; message: string } };

/** Every error the API sends is `{ error: { code, message } }`, whoever raised it. */
describe.skipIf(!liveEnabled)('error answers', () => {
  test('a malformed property id is not found, not a server error', async () => {
    const client = new LiveClient();
    await client.register(uniqueEmail('bad-id'));
    const res = await client.get('/api/gardens/not-a-uuid');
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Garden not found' } });
  });

  test('a malformed plant id is not found', async () => {
    const client = new LiveClient();
    await client.register(uniqueEmail('bad-plant-id'));
    const res = await client.get('/api/plants/42');
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Plant not found' } });
  });

  test('malformed JSON is a validation error', async () => {
    const res = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toEqual(expect.any(String));
  });

  test('an unknown route is not found', async () => {
    const res = await fetch(`${API_ORIGIN}/api/no-such-route`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorBody).error.code).toBe('NOT_FOUND');
  });
});
