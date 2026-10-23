import type { AdminPayout, PayoutStatus, ProviderPayment } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import type { Prisma } from '../../generated/prisma/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { recordChange, SYSTEM_ACTOR, type Actor } from '../../core/audit/record-change';
import { PrismaService } from '../../core/database/prisma.service';
import { runInTransaction, type Tx } from '../../core/database/transaction';
import { paginate, type Page, type PageInput } from '../../core/http/pagination';
import { centsToString } from '../../core/money/money';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../core/payment-provider/payment-provider.port';
import { assertPaymentMatches } from '../payments/helpers/payment-rules';
import {
  adminPayoutSelect,
  payoutSelect,
  toAccountPayout,
  toAdminPayout,
  type AccountPayout,
} from './helpers/payout.mapper';
import { payoutOutcome, payoutRetryDelayMs, type PayoutOutcome } from './helpers/payout-rules';
import { PayoutsRepository, type ClaimedPayout } from './payouts.repository';

const SWEEP_BATCH = 20;
/** Payouts shown on the admin account detail, newest first. */
const ACCOUNT_PAYOUTS_SHOWN = 20;

interface StoredPayout {
  id: string;
  accountId: string;
  amountCents: bigint;
  status: PayoutStatus;
  attempts: number;
  providerReference: string;
}

/**
 * Money sent back to customers (R-05 release, refunds), after the change that reserved it
 * committed (P2). One path settles every answer, whoever brought it (the worker's attempt or
 * the provider's webhook), with conditional updates on the attempt's reference: a payout is
 * SENT at most once, a FAILED attempt moves to a NEW reference (MO5) with backoff, and after
 * the last attempt the payout is FAILED and reported once. A provider that does not answer
 * changes nothing: the same reference is asked again later (MO4).
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PayoutsRepository,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Claims due payouts (one by id, or a batch) and sends each; returns how many were claimed. */
  async sendDue(input: { now: Date; payoutId?: string }): Promise<number> {
    const claimed = await this.repository.claimDue({
      now: input.now,
      limit: SWEEP_BATCH,
      payoutId: input.payoutId ?? null,
    });
    // One provider call per payout, outside any transaction (AN5); each is settled on its own.
    for (const payout of claimed) {
      try {
        await this.send(payout, input.now);
      } catch (error) {
        // An answer that is not ours, or a database error: reported, and the payout stays
        // PENDING (its lease brings it back). The rest of the batch still goes out.
        this.logger.error({ payoutId: payout.id, err: error }, 'payout not settled');
      }
    }
    return claimed.length;
  }

  /**
   * THE settlement of a provider answer about a payout (worker and webhook). Returns what
   * happened; `ignored` when the payout is gone, already settled, or another settler won.
   */
  async applyResult(
    actor: Actor,
    payoutId: string,
    payment: ProviderPayment,
    now = new Date(),
  ): Promise<PayoutOutcome | 'ignored'> {
    const outcome = await runInTransaction(this.prisma, async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        select: {
          id: true,
          accountId: true,
          amountCents: true,
          status: true,
          attempts: true,
          providerReference: true,
        },
      });
      if (!payout || payout.status !== 'PENDING') return 'ignored' as const;
      assertPaymentMatches(payment, {
        reference: payout.providerReference,
        amountCents: payout.amountCents,
        purpose: 'payout',
      });
      const next = payoutOutcome(payment.status, payout.attempts);
      if (next === 'wait') return next;
      const applied = await this.write(tx, { actor, payout, next, payment, now });
      return applied ? next : ('ignored' as const);
    });
    if (outcome === 'failed') {
      // After commit, once: only the settler whose conditional update won gets here (OB6).
      this.logger.error(
        { incident: 'payout_failed', payoutId, providerPaymentId: payment.id },
        'payout failed after its last attempt: money owed to the customer was not sent',
      );
    }
    return outcome;
  }

  /** `search` is the back office's `?q=`, built by the caller; it narrows next to the status. */
  listForAdmin(
    query: PageInput & { status?: PayoutStatus; search?: Prisma.PayoutWhereInput },
  ): Promise<Page<AdminPayout>> {
    const where: Prisma.PayoutWhereInput = {
      AND: [query.status ? { status: query.status } : {}, query.search ?? {}],
    };
    return paginate({
      query,
      count: () => this.prisma.payout.count({ where }),
      read: (window) =>
        this.prisma.payout.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...window,
          select: adminPayoutSelect,
        }),
      map: toAdminPayout,
    });
  }

  async listForAccount(accountId: string): Promise<AccountPayout[]> {
    const rows = await this.prisma.payout.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ACCOUNT_PAYOUTS_SHOWN,
      select: payoutSelect,
    });
    return rows.map(toAccountPayout);
  }

  private async send(payout: ClaimedPayout, now: Date): Promise<void> {
    let payment: ProviderPayment;
    try {
      // Idempotent by reference: asking again for an unanswered attempt is a re-read.
      payment = await this.provider.createPayment({
        reference: payout.providerReference,
        amountCents: centsToString(payout.amountCents),
        purpose: 'payout',
      });
    } catch (error) {
      if (error instanceof AppHttpException && error.code === 'payment.not_confirmed') {
        // The provider refused the payment outright (4xx): this attempt failed.
        await this.applyRefusal(payout, now);
        return;
      }
      // Timeout, 5xx, garbage: unknown. Nothing changes but the note; the lease brings it back.
      this.logger.warn({ payoutId: payout.id, err: error }, 'payout provider did not answer');
      await this.prisma.payout.updateMany({
        where: { id: payout.id, status: 'PENDING', providerReference: payout.providerReference },
        data: { lastError: 'provider_unavailable' },
      });
      return;
    }
    await this.applyResult(SYSTEM_ACTOR, payout.id, payment, now);
  }

  /** A refused create is the provider's "no" for this attempt: settled like a FAILED payment. */
  private applyRefusal(payout: ClaimedPayout, now: Date) {
    return this.applyResult(
      SYSTEM_ACTOR,
      payout.id,
      {
        id: `refused:${payout.providerReference}`,
        reference: payout.providerReference,
        amountCents: centsToString(payout.amountCents),
        purpose: 'payout',
        status: 'FAILED',
        approveUrl: 'https://provider.invalid/refused',
        createdAt: now.toISOString(),
        settledAt: now.toISOString(),
      },
      now,
    );
  }

  /** The conditional write of one outcome, with its audit and outbox rows. */
  private async write(
    tx: Tx,
    input: {
      actor: Actor;
      payout: StoredPayout;
      next: Exclude<PayoutOutcome, 'wait'>;
      payment: ProviderPayment;
      now: Date;
    },
  ): Promise<boolean> {
    const { payout, payment } = input;
    // Conditional on the attempt's reference: a second answer about it finds nothing to change.
    const updated = await tx.payout.updateMany({
      where: { id: payout.id, status: 'PENDING', providerReference: payout.providerReference },
      data: outcomeData(input),
    });
    if (updated.count !== 1) return false;
    await recordChange(tx, input.actor, {
      action: PAYOUT_ACTIONS[input.next],
      entityType: 'payout',
      entityId: payout.id,
      data: {
        accountId: payout.accountId,
        attempt: payout.attempts,
        providerPaymentId: payment.id,
      },
    });
    return true;
  }
}

function outcomeData(input: {
  payout: StoredPayout;
  next: Exclude<PayoutOutcome, 'wait'>;
  payment: ProviderPayment;
  now: Date;
}): Prisma.PayoutUpdateManyMutationInput {
  const { payout, payment, now } = input;
  switch (input.next) {
    case 'sent':
      return { status: 'SENT', sentAt: now, providerPaymentId: payment.id, lastError: null };
    case 'failed':
      return {
        status: 'FAILED',
        failedAt: now,
        providerPaymentId: payment.id,
        lastError: 'provider_failed',
      };
    case 'retry':
      // A new attempt is a new reference (MO5): the failed one can never pay later.
      return {
        attempts: payout.attempts + 1,
        providerReference: randomUUID(),
        nextAttemptAt: new Date(now.getTime() + payoutRetryDelayMs(payout.attempts)),
        providerPaymentId: null,
        lastError: 'provider_failed',
      };
  }
}

const PAYOUT_ACTIONS = {
  sent: 'payout.sent',
  failed: 'payout.failed',
  retry: 'payout.attempt_failed',
} as const;
