import { createRequire } from 'node:module';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

/**
 * Packages that ship both ESM and CJS builds. The app runs as CommonJS, and @acme/nest-core's
 * dist `require`s them; the tests must load the SAME (CJS) build, or Nest's DI sees two
 * PinoLogger / ThrottlerGuard classes and cannot resolve them.
 */
const DUAL_PACKAGES = ['nestjs-pino', '@nestjs/throttler', 'nestjs-zod'];

// SWC emits the decorator metadata Nest's DI needs (esbuild does not).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: DUAL_PACKAGES.map((name) => ({
      find: new RegExp(`^${name.replace('/', '\\/')}$`),
      replacement: require.resolve(name),
    })),
  },
  test: {
    env: { TZ: 'UTC', NODE_ENV: 'test' },
    include: ['test/integration/**/*.int-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
