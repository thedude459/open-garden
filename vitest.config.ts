import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts', 'apps/api/**/*.spec.ts', 'apps/api-e2e/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      include: [
        'libs/shared-types/src/lib/**/*.ts',
        'libs/plant-catalog/src/lib/**/*.ts',
        'libs/plant-favorites/src/lib/**/*.ts',
        'libs/plant-provider/src/lib/**/*.ts',
        'libs/auth/src/lib/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/index.ts',
        '**/plant-data-provider.ts',
        '**/plant.ts',
        // DB-backed modules need integration fixtures; covered separately later
        'libs/plant-catalog-data/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@open-garden/shared-types': path.resolve(__dirname, 'libs/shared-types/src/index.ts'),
      '@open-garden/plant-catalog': path.resolve(__dirname, 'libs/plant-catalog/src/index.ts'),
      '@open-garden/plant-provider': path.resolve(__dirname, 'libs/plant-provider/src/index.ts'),
      '@open-garden/plant-favorites': path.resolve(__dirname, 'libs/plant-favorites/src/index.ts'),
      '@open-garden/plant-catalog-data': path.resolve(
        __dirname,
        'libs/plant-catalog-data/src/index.ts',
      ),
      '@open-garden/auth': path.resolve(__dirname, 'libs/auth/src/index.ts'),
    },
  },
});
