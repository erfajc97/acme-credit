import {
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SIGNATURE_MAX_SKEW_SECONDS } from '@acme/contracts';
import type { Request } from 'express';
import { AppHttpException } from '../errors/app-http.exception';
import { verifySignature } from '../signing/signature';
import { ACCESS_KEY, type Access, type Principal } from './access.decorators';

/** Resolves the user of a bearer-token request; each service that has users provides one. */
export const ACCESS_AUTHENTICATOR = Symbol('ACCESS_AUTHENTICATOR');
export interface AccessAuthenticator {
  authenticate(request: Request): Promise<Principal | null>;
}

/** Shared secret per signing caller (P3), e.g. `{ network: '…', provider: '…' }`. */
export const SIGNING_SECRETS = Symbol('SIGNING_SECRETS');
export type SigningSecrets = Readonly<Record<string, string>>;

type GuardedRequest = Request & { principal?: Principal; signedBy?: string; rawBody?: Buffer };

/** Default-deny (AN10): a route passes only when its one marker allows the caller. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(ACCESS_AUTHENTICATOR) private readonly authenticator?: AccessAuthenticator,
    @Optional() @Inject(SIGNING_SECRETS) private readonly secrets?: SigningSecrets,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<Access | undefined>(ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<GuardedRequest>();

    switch (access?.kind) {
      case 'public':
        return true;
      case 'roles':
        return this.checkRoles(request, access.roles);
      case 'signed':
        return this.checkSignature(request, access.caller);
      default:
        throw new AppHttpException('common.forbidden');
    }
  }

  private async checkRoles(request: GuardedRequest, roles: readonly string[]): Promise<boolean> {
    if (!this.authenticator) throw new AppHttpException('common.forbidden');
    const principal = await this.authenticator.authenticate(request);
    if (!principal) throw new AppHttpException('common.unauthenticated');
    if (!roles.includes(principal.role)) throw new AppHttpException('common.forbidden');
    request.principal = principal;
    return true;
  }

  private checkSignature(request: GuardedRequest, caller: string): boolean {
    const secret = this.secrets?.[caller];
    if (!secret) throw new AppHttpException('common.forbidden');
    const header = (name: string) => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const result = verifySignature({
      secret,
      method: request.method,
      path: request.originalUrl,
      // Signed as sent (P3): a replay under another key is a mismatch, never a new effect.
      idempotencyKey: header('idempotency-key') ?? '',
      rawBody: request.rawBody?.toString('utf8') ?? '',
      signature: header('x-signature'),
      timestamp: header('x-signature-timestamp'),
      nowSeconds: Math.floor(Date.now() / 1000),
      maxSkewSeconds: SIGNATURE_MAX_SKEW_SECONDS,
    });
    if (result !== 'valid') throw new AppHttpException('signature.invalid', { reason: result });
    request.signedBy = caller;
    return true;
  }
}
