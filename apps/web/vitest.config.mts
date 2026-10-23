/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    env: { TZ: 'UTC' },
    setupFiles: ['./vitest.setup.ts'],
    // The setup's afterEach imports the app's stores lazily (so a spec's vi.mock still applies);
    // on a cold worker under coverage that first import can take longer than the 10 s default.
    hookTimeout: 30_000,
    include: ['src/**/__tests__/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/app/**/hooks/**',
        'src/app/**/helpers/**',
        'src/app/**/mutations/**',
        'src/app/**/services/**',
        'src/app/lib/**',
        'src/app/i18n/**',
        'src/app/store/**',
        'src/app/tanstack-queries/**',
      ],
      exclude: ['**/__tests__/**', '**/*.json'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
