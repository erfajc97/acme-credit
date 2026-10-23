import {
  DEFAULT_THROTTLE,
  globalProviders,
  loggerParams,
  SIGNING_SECRETS,
  type SigningSecrets,
} from '@acme/nest-core';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { RuntimeModule } from './core/background/runtime.module';
import { ConfigModule } from './core/config/config.module';
import type { Env } from './core/config/env';
import { ENV } from './core/config/env.provider';
import { CoreClientModule } from './core/core-client/core-client.module';
import { HealthModule } from './modules/health/health.module';
import { ProviderModule } from './modules/provider/provider.module';
import { PurchasesModule } from './modules/purchases/purchases.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => loggerParams(env) }),
    ThrottlerModule.forRoot(DEFAULT_THROTTLE),
    RuntimeModule,
    CoreClientModule,
    HealthModule,
    PurchasesModule,
    ProviderModule,
  ],
  providers: [
    ...globalProviders(),
    {
      // `@Signed('core')` routes (the provider API) verify the core's signature (P3).
      provide: SIGNING_SECRETS,
      inject: [ENV],
      useFactory: (env: Env): SigningSecrets => ({ core: env.PROVIDER_API_SECRET }),
    },
  ],
})
export class AppModule {}
