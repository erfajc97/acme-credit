import { Global, Module } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.provider';
import { HttpPaymentProvider } from './http-payment-provider';
import { PAYMENT_PROVIDER } from './payment-provider.port';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => new HttpPaymentProvider(env),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProviderModule {}
