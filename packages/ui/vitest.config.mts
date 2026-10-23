import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    env: { TZ: 'UTC' },
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/index.ts'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
