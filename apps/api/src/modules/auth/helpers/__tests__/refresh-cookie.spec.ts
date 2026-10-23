import { describe, expect, it } from 'vitest';
import { refreshCookieOptions } from '../refresh-cookie';

const base = { COOKIE_SECURE: true, REFRESH_TOKEN_TTL_SECONDS: 604_800 };

describe('refresh cookie options', () => {
  it('is an httpOnly cookie scoped to /v1/auth, Strict by default and not partitioned', () => {
    expect(refreshCookieOptions({ ...base, COOKIE_SAME_SITE: 'strict' })).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/v1/auth',
      partitioned: false,
    });
  });

  it('is Partitioned (CHIPS) when it must travel cross-site, so browsers that block third-party cookies still keep it', () => {
    // Safari and mobile browsers drop an unpartitioned SameSite=None cookie: the session died on reload.
    expect(refreshCookieOptions({ ...base, COOKIE_SAME_SITE: 'none' })).toMatchObject({
      sameSite: 'none',
      secure: true,
      partitioned: true,
    });
  });

  it('stays unpartitioned for Lax (same-site apps)', () => {
    expect(refreshCookieOptions({ ...base, COOKIE_SAME_SITE: 'lax' }).partitioned).toBe(false);
  });
});
