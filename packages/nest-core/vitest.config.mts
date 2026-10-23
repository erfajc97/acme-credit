import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, so specs can boot small Nest apps (esbuild does not).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    env: { TZ: 'UTC', NODE_ENV: 'test' },
    include: ['src/**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/index.ts'],
      thresholds: { lines: 90, branches: 90 },
    },
  },
});
