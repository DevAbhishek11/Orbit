import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests resolve @orbit/shared straight from source — no build step needed.
const sharedSrc = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@orbit/shared': sharedSrc,
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/server.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
});
