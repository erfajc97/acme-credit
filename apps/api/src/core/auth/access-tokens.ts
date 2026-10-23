import type { AccessAuthenticator, Principal } from '@acme/nest-core';
import { ROLES } from '@acme/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import type { Env } from '../config/env';
import { ENV } from '../config/env.provider';

const ISSUER = 'acme-credit/lending-core';
const ALGORITHM = 'HS256';

/**
 * Short-lived HS256 access tokens (claims: sub + role). They are the `AccessAuthenticator` of
 * the shared default-deny guard: a bearer token that does not verify is simply "no principal".
 */
@Injectable()
export class AccessTokens implements AccessAuthenticator {
  private readonly key: Uint8Array;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  get ttlSeconds(): number {
    return this.env.ACCESS_TOKEN_TTL_SECONDS;
  }

  issue(principal: Principal): Promise<string> {
    return new SignJWT({ role: principal.role })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(principal.id)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async authenticate(request: { headers: Record<string, unknown> }): Promise<Principal | null> {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    try {
      const { payload } = await jwtVerify(header.slice('Bearer '.length), this.key, {
        issuer: ISSUER,
        algorithms: [ALGORITHM],
      });
      const role = ROLES.find((candidate) => candidate === payload.role);
      if (!payload.sub || !role) return null;
      return { id: payload.sub, role };
    } catch {
      // Expired, forged or malformed: the guard answers 401 for a missing principal.
      return null;
    }
  }
}
