import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import nxPlugin from '@nx/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.nx/**', 'apps/web/.angular/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@nx': nxPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
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
              ],
            },
          ],
        },
      ],
    },
  },
];
