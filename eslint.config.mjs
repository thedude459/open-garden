import angular from 'angular-eslint';
import nxPlugin from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '.nx/**',
      'apps/web/.angular/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@nx': nxPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Fakes and fixtures implement Promise-returning interfaces without awaiting.
      '@typescript-eslint/require-await': 'off',
      // Angular's HttpErrorResponse is the error HttpClient throws; it does not extend Error.
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'package', package: '@angular/common', name: 'HttpErrorResponse' }] },
      ],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: ['type:lib', 'type:app'],
            },
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:types', 'layer:data-access', 'layer:domain'],
            },
            {
              sourceTag: 'layer:data-access',
              onlyDependOnLibsWithTags: ['layer:types', 'layer:data-access'],
            },
            {
              sourceTag: 'layer:types',
              onlyDependOnLibsWithTags: ['layer:types'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: [
                'scope:shared',
                'scope:plant',
                'scope:gardens',
                'scope:calendar',
                'scope:plantings',
                'scope:layout',
                'scope:care',
                'scope:pipeline',
              ],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'scope:shared',
                'scope:plant',
                'scope:gardens',
                'scope:calendar',
                'scope:plantings',
                'scope:layout',
                'scope:care',
                'scope:pipeline',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    // Vitest's asymmetric matchers and mock.calls are typed any.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
    },
  },
  {
    files: ['apps/web/src/**/*.ts', 'libs/web-ui/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // `x != null` deliberately matches both null and undefined.
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
    },
  },
);
