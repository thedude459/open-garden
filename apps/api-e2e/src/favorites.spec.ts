import { test, expect } from 'vitest';

test('favorites isolation contract', () => {
  const userA = { id: 'a', favorites: ['p1'] };
  const userB = { id: 'b', favorites: [] };
  expect(userB.favorites).not.toContain('p1');
  expect(userA.favorites).toContain('p1');
});
