import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { TZ: 'UTC' },
    include: ['src/**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/index.ts'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
