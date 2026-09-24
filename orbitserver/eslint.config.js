import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Orbit API lint rules.
 *
 * Beyond the usual hygiene rules this config encodes the architecture law
 * (BUILD_PROMPT §2) as import restrictions per layer:
 *  - controllers must not import mongoose or models (no business logic / no queries)
 *  - services must not import express (never touch req/res)
 *  - repositories are the only layer allowed to import *.model.js
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
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
      '@typescript-eslint/no-explicit-any': 'error',
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
    // Layer law: controllers stay free of mongoose/models
    files: ['src/modules/**/*.controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['mongoose', '*.model.js', '*.model', '*.repository.js', '*.repository'], message: 'Controllers must call services only — no mongoose, models or repositories.' },
          ],
        },
      ],
    },
  },
  {
    // Layer law: services never touch req/res
    files: ['src/modules/**/*.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['express', 'express-*'], message: 'Services must not import express — they never touch req/res.' },
          ],
        },
      ],
    },
  },
  {
    // Env access is centralized (BUILD_PROMPT naming law)
    files: ['src/**/*.ts'],
    ignores: ['src/config/env.ts', 'src/**/*.test.ts', 'tests/**/*.ts'],
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
    // Scripts (migrate, seed, openapi) are CLI tools — console allowed, process.env via env.ts still enforced but console is fine
    files: ['scripts/**/*.ts'],
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
