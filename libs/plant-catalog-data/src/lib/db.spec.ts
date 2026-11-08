import { afterEach, expect, test, vi } from 'vitest';
import type { Pool } from 'pg';
import { createDb } from './db';

let pool: Pool | undefined;

afterEach(async () => {
  await pool?.end();
  pool = undefined;
  vi.restoreAllMocks();
});

test('a pool error goes to the handler instead of crashing the process', () => {
  const onPoolError = vi.fn();
  ({ pool } = createDb('postgresql://nobody@127.0.0.1:1/none', { onPoolError }));
  const error = new Error('Connection terminated unexpectedly');

  // Without a listener, emitting 'error' throws (Node's unhandled error event).
  expect(() => pool!.emit('error', error)).not.toThrow();
  expect(onPoolError).toHaveBeenCalledWith(error);
});

test('the default handler logs the error', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  ({ pool } = createDb('postgresql://nobody@127.0.0.1:1/none'));

  expect(() => pool!.emit('error', new Error('server closed the connection'))).not.toThrow();
  expect(log).toHaveBeenCalledWith(expect.stringContaining('server closed the connection'));
});
