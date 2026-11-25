import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('is healthy while the database answers', async () => {
    const db = { execute: async () => ({ rows: [{ '?column?': 1 }] }) };
    await expect(new HealthController({ db } as never).ok()).resolves.toEqual({ status: 'ok' });
  });

  it('reports unavailable when the database does not answer', async () => {
    const db = {
      execute: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      },
    };
    await expect(new HealthController({ db } as never).ok()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The database cannot be reached',
    });
  });
});
