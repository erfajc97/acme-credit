import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { TZ: 'UTC' },
    include: ['src/**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/modules/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.module.ts', '**/*.controller.ts', '**/dto/**'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
