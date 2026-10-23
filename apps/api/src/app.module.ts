import { DEFAULT_THROTTLE, globalProviders, loggerParams } from '@acme/nest-core';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthCoreModule } from './core/auth/auth-core.module';
import { ConfigModule } from './core/config/config.module';
import type { Env } from './core/config/env';
import { ENV } from './core/config/env.provider';
import { DatabaseModule } from './core/database/database.module';
import { IdempotencyModule } from './core/idempotency/idempotency.module';
import { PaymentProviderModule } from './core/payment-provider/payment-provider.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationsModule } from './modules/authorizations/authorizations.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => loggerParams(env) }),
    ThrottlerModule.forRoot(DEFAULT_THROTTLE),
    DatabaseModule,
    AuthCoreModule,
    IdempotencyModule,
    PaymentProviderModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    PaymentsModule,
    AuthorizationsModule,
    AdminModule,
  ],
  providers: globalProviders(),
})
export class AppModule {}
