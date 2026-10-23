import {
  PUBLIC_API_URL,
  PUBLIC_DEMO_ADMIN_EMAIL,
  PUBLIC_DEMO_ADMIN_PASSWORD,
  PUBLIC_DEMO_MODE,
} from 'astro:env/client';
import { demoLogin } from '@acme/ui';

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

/**
 * Typed public configuration for client code (WA7). Everything here ships in the bundle, so it
 * only re-exports `astro:env/client` values. It is also the one seam tests can rely on.
 */
export const env = {
  /** Core API origin (lending-core). */
  apiUrl: withoutTrailingSlash(PUBLIC_API_URL),
  /**
   * The seeded demo admin the sign-in demo button fills, or null (demo mode off, the default, or
   * no values). Only from public build-time env; the admin still submits the form.
   */
  demoLogin: demoLogin({
    enabled: PUBLIC_DEMO_MODE,
    email: PUBLIC_DEMO_ADMIN_EMAIL,
    password: PUBLIC_DEMO_ADMIN_PASSWORD,
  }),
} as const;
