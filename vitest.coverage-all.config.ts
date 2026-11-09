import { defineConfig } from 'vitest/config';
import base from './vitest.config';

/**
 * Report-only coverage of the whole codebase (apps and libs), alongside the
 * 80% gate in vitest.config.ts, which measures the domain libraries only.
 * No thresholds: this shows where tests are missing, it does not fail builds.
 * Run with `npm run test:coverage:all`; the summary goes to coverage/all.
 *
 * The coverage block is replaced, not merged: mergeConfig appends arrays, which
 * would carry over the gate's include/exclude lists.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.ts', 'libs/*/src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/test-memory.ts', '**/test-db.ts', 'apps/*-e2e/**'],
      reporter: ['text-summary', 'json', 'html'],
      reportsDirectory: 'coverage/all',
    },
  },
});
