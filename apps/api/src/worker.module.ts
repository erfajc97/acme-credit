import { loggerParams } from '@acme/nest-core';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './core/config/config.module';
import type { Env } from './core/config/env';
import { ENV } from './core/config/env.provider';
import { DatabaseModule } from './core/database/database.module';
import { IdempotencyModule } from './core/idempotency/idempotency.module';
import { LedgerReconciliation } from './core/ledger/reconciliation';
import { OUTBOX_HANDLERS, OutboxRelay } from './core/outbox/outbox-relay';
import { PaymentProviderModule } from './core/payment-provider/payment-provider.module';
import { PERIODIC_JOBS, WorkerRunner, type PeriodicJob } from './core/worker/worker-runner.service';
import { LedgerReconciliationJob } from './modules/admin/jobs/ledger-reconciliation.job';
import { AuthorizationsModule } from './modules/authorizations/authorizations.module';
import { AuthorizationsService } from './modules/authorizations/authorizations.service';
import { PendingPaymentsSweeper } from './modules/payments/jobs/pending-payments.sweeper';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutRequestedHandler } from './modules/payouts/jobs/payout-requested.handler';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PayoutsService } from './modules/payouts/payouts.service';

const SWEEP_INTERVAL_MS = 30_000;
/** Holds expire in days: a minute of lateness releases nothing early and costs nothing. */
const HOLD_SWEEP_INTERVAL_MS = 60_000;
/** A full scan of accounts and per-account postings: a drift found within minutes is enough. */
const RECONCILIATION_INTERVAL_MS = 5 * 60_000;

/**
 * The outbox worker's process (P2, AN11): no HTTP, only the relay and the periodic sweeps
 * (pending payments, payouts, expired holds, ledger reconciliation).
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({ inject: [ENV], useFactory: (env: Env) => loggerParams(env) }),
    DatabaseModule,
    IdempotencyModule,
    PaymentProviderModule,
    PaymentsModule,
    PayoutsModule,
    AuthorizationsModule,
  ],
  providers: [
    OutboxRelay,
    PayoutRequestedHandler,
    PendingPaymentsSweeper,
    LedgerReconciliation,
    LedgerReconciliationJob,
    {
      provide: OUTBOX_HANDLERS,
      inject: [PayoutRequestedHandler],
      useFactory: (payouts: PayoutRequestedHandler) => [payouts],
    },
    {
      provide: PERIODIC_JOBS,
      inject: [
        PendingPaymentsSweeper,
        PayoutsService,
        AuthorizationsService,
        LedgerReconciliationJob,
      ],
      useFactory: (
        sweeper: PendingPaymentsSweeper,
        payouts: PayoutsService,
        authorizations: AuthorizationsService,
        reconciliation: LedgerReconciliationJob,
      ): PeriodicJob[] => [
        { name: 'pending-payments', intervalMs: SWEEP_INTERVAL_MS, run: () => sweeper.sweepOnce() },
        {
          name: 'payouts',
          intervalMs: SWEEP_INTERVAL_MS,
          run: () => payouts.sendDue({ now: new Date() }),
        },
        {
          name: 'hold-expiry',
          intervalMs: HOLD_SWEEP_INTERVAL_MS,
          run: () => authorizations.releaseExpiredHolds(),
        },
        {
          name: 'ledger-reconciliation',
          intervalMs: RECONCILIATION_INTERVAL_MS,
          run: () => reconciliation.runOnce(),
        },
      ],
    },
    WorkerRunner,
  ],
})
export class WorkerModule {}
