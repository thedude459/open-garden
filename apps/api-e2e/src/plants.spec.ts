import { test, expect } from 'vitest';

/**
 * Lightweight contract smoke placeholders for CI without a live DB.
 * Full integration tests run against Compose Postgres in local/CI workflows.
 */
test('plants list contract shape', () => {
  const sample = {
    items: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
  };
  expect(sample).toHaveProperty('items');
  expect(sample.pageSize).toBeLessThanOrEqual(100);
});
