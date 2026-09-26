import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: [
      '**/worker/**/*.ts',
      'src/worker/**/*.ts',
      '**/modules/admin/queues.routes.ts',
      'src/modules/admin/queues.routes.ts',
      '**/realtime/socket.server.ts',
      'src/realtime/socket.server.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    files: ['**/modules/**/*.controller.ts', 'src/modules/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['mongoose', '*.model.js', '*.model', '*.repository.js', '*.repository'],
              message: 'Controllers must call services only — no mongoose, models or repositories.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/modules/**/*.service.ts', 'src/modules/**/*.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express-*'],
              message: 'Services must not import express — they never touch req/res.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/src/**/*.ts', 'src/**/*.ts'],
    ignores: [
      '**/config/env.ts',
      'src/config/env.ts',
      '**/*.test.ts',
      'src/**/*.test.ts',
      '**/tests/**/*.ts',
      'tests/**/*.ts',
    ],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read configuration through config/env.ts only.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      'no-restricted-properties': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='it'][callee.property.name='only']",
          message: 'Never commit .only tests.',
        },
        {
          selector: "CallExpression[callee.object.name='describe'][callee.property.name='only']",
          message: 'Never commit .only tests.',
        },
      ],
    },
  },
  {
    files: ['**/scripts/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-empty': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
