import { safeReturnPath } from '@acme/ui';
import { APP_HOME_PATH, localHref } from '@/app/lib/endpoints';

/**
 * `returnTo` comes from the query string, so it is attacker-controlled (W14): only a path that
 * resolves to this page's own origin passes (the shared guard); anything else falls back to the
 * console's home in the page's locale.
 */
export function safeReturnTo(
  value: string | null,
  fallback: string = localHref(APP_HOME_PATH),
): string {
  return safeReturnPath(value, window.location.origin) ?? fallback;
}

/** The sign-in URL that brings the admin back to `path` afterwards. */
export function signInHref(signInPath: string, path: string): string {
  return `${signInPath}?returnTo=${encodeURIComponent(path)}`;
}
