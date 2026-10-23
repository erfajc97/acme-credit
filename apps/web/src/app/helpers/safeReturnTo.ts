import { safeReturnPath } from '@acme/ui';
import { APP_HOME_PATH } from '@/app/lib/endpoints';

/**
 * `returnTo` comes from the query string, so it is attacker-controlled (W14): only a path that
 * resolves to this page's own origin passes (the shared guard); anything else falls back.
 */
export function safeReturnTo(value: string | null, fallback: string = APP_HOME_PATH): string {
  return safeReturnPath(value, window.location.origin) ?? fallback;
}

/** The sign-in URL that brings the customer back to `path` afterwards. */
export function signInHref(signInPath: string, path: string): string {
  return `${signInPath}?returnTo=${encodeURIComponent(path)}`;
}
