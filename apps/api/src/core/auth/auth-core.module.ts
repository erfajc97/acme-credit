import { ACCESS_AUTHENTICATOR, SIGNING_SECRETS, type SigningSecrets } from '@acme/nest-core';
import { Global, Module } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.provider';
import { AccessTokens } from './access-tokens';
import { PasswordHasher } from './password-hasher';

/** Wires the shared guard: bearer tokens for users, HMAC secrets for signed callers (P3). */
@Global()
@Module({
  providers: [
    AccessTokens,
    PasswordHasher,
    { provide: ACCESS_AUTHENTICATOR, useExisting: AccessTokens },
    {
      provide: SIGNING_SECRETS,
      inject: [ENV],
      useFactory: (env: Env): SigningSecrets => ({
        network: env.NETWORK_SIGNING_SECRET,
        provider: env.PROVIDER_SIGNING_SECRET,
      }),
    },
  ],
  exports: [AccessTokens, PasswordHasher, ACCESS_AUTHENTICATOR, SIGNING_SECRETS],
})
export class AuthCoreModule {}
