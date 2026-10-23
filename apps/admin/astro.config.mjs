import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { splashGateScriptHash, themeScriptHash } from '@acme/ui/theme-hash';
import { defineConfig, envField } from 'astro/config';

/** Origins the browser may call; the same values the build bakes into astro:env. */
const CONNECT_SRC = [process.env.PUBLIC_API_URL ?? 'http://localhost:3000'];

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4322',
  integrations: [react()],
  // es-MX is the default and lives at /, en-US under /en/ (one page source per route).
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'never' },
  // The console has no landing page: the dashboard's session gate sends visitors to sign in.
  redirects: { '/': '/dashboard', '/en': '/en/dashboard' },
  // Meta CSP with hashes for every script and style Astro emits; nginx adds frame-ancestors.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self' ${CONNECT_SRC.join(' ')}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // The pre-paint theme and splash-gate scripts are is:inline, which Astro does not hash itself.
      scriptDirective: { hashes: [themeScriptHash(), splashGateScriptHash()] },
      // Static <style> tags injected at runtime by react-aria (HeroUI) and sonner (toasts).
      // A library upgrade that changes them shows up as a CSP console error in the E2E smoke.
      styleDirective: {
        hashes: [
          'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=',
          'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o=',
        ],
      },
    },
  },
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:3000',
      }),
      // Demo helper on the sign-in form. Off and empty by default so a production build ships no
      // credential; the local .env turns it on with the seeded demo admin (scripts/up.mjs).
      PUBLIC_DEMO_MODE: envField.boolean({ context: 'client', access: 'public', default: false }),
      PUBLIC_DEMO_ADMIN_EMAIL: envField.string({
        context: 'client',
        access: 'public',
        default: '',
      }),
      PUBLIC_DEMO_ADMIN_PASSWORD: envField.string({
        context: 'client',
        access: 'public',
        default: '',
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // The CSP above has no 'unsafe-eval'. Zod 4 probes `new Function` to speed up object
          // parsing, which DevTools reports as a CSP Issue on every page. Its jitless mode never
          // probes, but must be on before any schema is built, and the contract's CommonJS zod
          // copy is built inside a vendor chunk. Every chunk therefore starts by turning it on in
          // zod's global config (the object `z.config()` writes, shared by every zod copy).
          banner:
            'globalThis.__zod_globalConfig=Object.assign(globalThis.__zod_globalConfig??{},{jitless:true});',
        },
      },
    },
    // @acme/contracts ships CommonJS (tsc output): Node loads it natively during SSR/prerender,
    // and the browser gets the pre-bundled ESM copy (optimizeDeps below).
    ssr: { external: ['@acme/contracts'] },
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@heroui/react',
        '@tanstack/react-query',
        'zustand',
        'sonner',
        'react-hook-form',
        '@hookform/resolvers/zod',
        'zod',
        'lucide-react',
        // The shared contract is CommonJS (tsc output): pre-bundled so islands can import it.
        '@acme/contracts',
      ],
    },
  },
});
