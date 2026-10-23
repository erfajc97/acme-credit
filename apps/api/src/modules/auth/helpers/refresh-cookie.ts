import type { Env } from '../../../core/config/env';

export const REFRESH_COOKIE = 'acme_rt';
const REFRESH_COOKIE_PATH = '/v1/auth';

export interface RefreshCookieOptions {
  httpOnly: true;
  sameSite: Env['COOKIE_SAME_SITE'];
  secure: boolean;
  path: string;
  partitioned: boolean;
  maxAge?: number;
}

/**
 * The refresh token's cookie: httpOnly and scoped to /v1/auth. When the apps live on another
 * site (`SameSite=None`, e.g. separate *.onrender.com hosts) it is also Partitioned (CHIPS):
 * Safari and mobile browsers drop unpartitioned third-party cookies, which ended the session on
 * the next page load; a partitioned cookie is kept under the app's own site instead.
 */
export function refreshCookieOptions(
  env: Pick<Env, 'COOKIE_SAME_SITE' | 'COOKIE_SECURE'>,
): RefreshCookieOptions {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
    path: REFRESH_COOKIE_PATH,
    partitioned: env.COOKIE_SAME_SITE === 'none',
  };
}
