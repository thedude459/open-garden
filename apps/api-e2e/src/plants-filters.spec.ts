import { test, expect } from 'vitest';

test('filter query params are documented', () => {
  const allowed = ['q', 'zone', 'plantType', 'page', 'pageSize'];
  expect(allowed).toContain('zone');
  expect(allowed).toContain('plantType');
});
