import {
  PUBLIC_API_URL,
  PUBLIC_DEMO_EMAIL,
  PUBLIC_DEMO_MODE,
  PUBLIC_DEMO_PASSWORD,
  PUBLIC_NETWORK_URL,
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
  /** Card network simulator origin (store checkout, voids and the payment provider). */
  networkUrl: withoutTrailingSlash(PUBLIC_NETWORK_URL),
  /**
   * Demo helpers on the auth forms, only from public build-time env (false and empty by default).
   * They only fill a form; the customer still submits it.
   */
  demo: {
    /** Shows the sign-up "fill test data" button. */
    enabled: PUBLIC_DEMO_MODE,
    /** The seeded demo customer for the sign-in button, or null when there is none to offer. */
    login: demoLogin({
      enabled: PUBLIC_DEMO_MODE,
      email: PUBLIC_DEMO_EMAIL,
      password: PUBLIC_DEMO_PASSWORD,
    }),
  },
} as const;
