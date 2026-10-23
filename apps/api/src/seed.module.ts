import { Global, Module } from '@nestjs/common';
import { PasswordHasher } from './core/auth/password-hasher';
import { ConfigModule } from './core/config/config.module';
import type { Env } from './core/config/env';
import { ENV } from './core/config/env.provider';
import { DatabaseModule } from './core/database/database.module';
import { IdempotencyModule } from './core/idempotency/idempotency.module';
import { InstantPaymentProvider } from './core/payment-provider/instant-payment-provider';
import { PAYMENT_PROVIDER } from './core/payment-provider/payment-provider.port';
import { UsersSeeder } from './modules/auth/users.seeder';
import { DemoModule } from './modules/demo/demo.module';

/**
 * The seed's provider: in process, so seeding needs no network and never touches the real
 * simulator. Only this module (the seed's context) provides it.
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => new InstantPaymentProvider(env.PROVIDER_API_URL),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
class SeedPaymentProviderModule {}

@Module({
  imports: [ConfigModule, DatabaseModule, IdempotencyModule, SeedPaymentProviderModule, DemoModule],
  providers: [PasswordHasher, UsersSeeder],
})
export class SeedModule {}
