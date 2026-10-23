import type { ProviderPayment } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SYSTEM_ACTOR } from '../../../core/audit/record-change';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../../core/payment-provider/payment-provider.port';
import { PaymentSettlementService, type PaymentTarget } from '../payment-settlement.service';

/** A payment still PENDING after this long is asked about again (MO4). */
export const STALE_AFTER_MS = 60_000;
const BATCH = 20;

type SweptPayment = PaymentTarget & { providerPaymentId: string; expiresAt: Date };

/**
 * Late approvals, lost webhooks and abandoned checkouts: re-asks the provider about deposits
 * and repayments that are still PENDING. An answer settles through the SAME path as the
 * webhook. A payment the provider confirms is still unpaid (PENDING there, or unknown to it)
 * is marked EXPIRED once its expiry passed. Uncertain is not "no": a provider that does not
 * answer leaves the row PENDING for the next sweep.
 */
@Injectable()
export class PendingPaymentsSweeper {
  private readonly logger = new Logger(PendingPaymentsSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: PaymentSettlementService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Returns how many payments this pass settled or expired. */
  async sweepOnce(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - STALE_AFTER_MS);
    const where = {
      status: 'PENDING' as const,
      createdAt: { lt: before },
      providerPaymentId: { not: null },
    };
    const select = {
      id: true,
      accountId: true,
      amountCents: true,
      providerPaymentId: true,
      expiresAt: true,
    };
    const orderBy = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];
    const deposits = await this.prisma.collateralDeposit.findMany({
      where,
      select,
      orderBy,
      take: BATCH,
    });
    const repayments = await this.prisma.repayment.findMany({
      where,
      select,
      orderBy,
      take: BATCH,
    });
    const swept = [
      ...deposits.map((row) => ({ purpose: 'deposit' as const, ...row })),
      ...repayments.map((row) => ({ purpose: 'repayment' as const, ...row })),
    ].flatMap((row): SweptPayment[] =>
      // The where above guarantees the provider id; the filter keeps the types honest.
      row.providerPaymentId
        ? [{ ...row, providerPaymentId: row.providerPaymentId, reference: row.id, settled: false }]
        : [],
    );
    let changed = 0;
    for (const payment of swept) {
      if (await this.resolve(payment, now)) changed += 1;
    }
    return changed;
  }

  private async resolve(target: SweptPayment, now: Date): Promise<boolean> {
    const expired = now.getTime() >= target.expiresAt.getTime();
    let payment: ProviderPayment;
    try {
      payment = await this.provider.getPayment(target.providerPaymentId);
    } catch (error) {
      // The provider answered that it does not know the payment: it can never be paid.
      if (expired && isUnknownAtProvider(error)) {
        return this.settlement.expire(SYSTEM_ACTOR, target, now);
      }
      this.logger.warn({ reference: target.id, err: error }, 'pending payment not re-read');
      return false;
    }
    if (payment.status === 'PENDING') {
      return expired ? this.settlement.expire(SYSTEM_ACTOR, target, now) : false;
    }
    try {
      await this.settlement.settle(SYSTEM_ACTOR, target, payment);
      return true;
    } catch (error) {
      this.logger.warn({ reference: target.id, err: error }, 'pending payment not settled');
      return false;
    }
  }
}

/** A 4xx from the provider (`payment.not_confirmed`), as opposed to a timeout or a 5xx. */
function isUnknownAtProvider(error: unknown): boolean {
  return error instanceof AppHttpException && error.code === 'payment.not_confirmed';
}
