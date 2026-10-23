import { Global, Logger, Module } from '@nestjs/common';
import { CLOCK, type Clock } from '../clock/clock';
import type { Env } from '../config/env';
import { ENV } from '../config/env.provider';
import { sleep } from '../retry/retry';
import { CORE_CLIENT } from './core-client.port';
import { HttpCoreClient } from './http-core-client';

/** Each attempt to the core gives up after 5 s (A9). */
const CORE_TIMEOUT_MS = 5_000;
const CORE_BACKOFF = { baseDelayMs: 200, maxDelayMs: 5_000 };

@Global()
@Module({
  providers: [
    {
      provide: CORE_CLIENT,
      inject: [ENV, CLOCK],
      useFactory: (env: Env, clock: Clock) =>
        new HttpCoreClient({
          baseUrl: env.CORE_API_URL,
          networkSecret: env.NETWORK_SIGNING_SECRET,
          providerSecret: env.PROVIDER_SIGNING_SECRET,
          clock,
          sleep,
          fetch: (input, init) => fetch(input, init),
          timeoutMs: CORE_TIMEOUT_MS,
          backoff: CORE_BACKOFF,
          logger: new Logger(HttpCoreClient.name),
        }),
    },
  ],
  exports: [CORE_CLIENT],
})
export class CoreClientModule {}
