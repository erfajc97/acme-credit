import { MAX_ACCOUNT_COLLATERAL_CENTS, type ProviderPayment } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable } from '@nestjs/common';
import type { PaymentStatus } from '../../generated/prisma/client';
import { recordChange, type Actor } from '../../core/audit/record-change';
import { PrismaService } from '../../core/database/prisma.service';
import { runInTransaction, type Tx } from '../../core/database/transaction';
import { LEDGER, postJournalEntry, transfer } from '../../core/ledger/ledger';
import { centsToString, limitForDeposit, minCents } from '../../core/money/money';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../core/payment-provider/payment-provider.port';
import type { AccountRow } from '../accounts/account.mapper';
import { issueCard } from '../accounts/helpers/account-rules';
import { lockAndRead } from '../accounts/helpers/lock-and-read';
import { requestPayout } from '../payouts/helpers/request-payout';
import { PayoutsService } from '../payouts/payouts.service';
import { assertPaymentMatches, type PaymentPurpose } from './helpers/payment-rules';

/** Our row behind a provider payment, found by OUR reference. */
export interface PaymentTarget {
  purpose: PaymentPurpose;
  id: string;
  /** What the provider knows: the row id, or a payout's current attempt reference (MO5). */
  reference: string;
  accountId: string;
  amountCents: bigint;
  providerPaymentId: string | null;
  settled: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * A payment the provider may still pay: PENDING, or EXPIRED (we stopped counting it as in
 * flight, but a late approval at the bank is still credited through the same path).
 */
function isOpen(status: PaymentStatus): boolean {
  return status === 'PENDING' || status === 'EXPIRED';
}

/**
 * Settles provider payments (MO4): the webhook and the worker's sweep both end here, so a late
 * approval is settled by the SAME code as a prompt one. The provider's state is always
 * re-read; a webhook only says "look again". Settling is idempotent: a row that is no longer
 * PENDING is left alone.
 */
@Injectable()
export class PaymentSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly payouts: PayoutsService,
  ) {}

  /** Webhook: unknown reference → 404 (final); provider down → 503 (the sender retries). */
  async handleWebhook(actor: Actor, webhook: { paymentId: string; reference: string }) {
    const target = await this.findByReference(webhook.reference);
    if (!target) throw new AppHttpException('common.not_found');
    if (target.settled) return;
    const payment = await this.provider.getPayment(target.providerPaymentId ?? webhook.paymentId);
    await this.settle(actor, target, payment);
  }

  async findByReference(reference: string): Promise<PaymentTarget | null> {
    if (!UUID.test(reference)) return null;
    const select = {
      id: true,
      accountId: true,
      amountCents: true,
      providerPaymentId: true,
      status: true,
    } as const;
    const deposit = await this.prisma.collateralDeposit.findUnique({
      where: { id: reference },
      select,
    });
    if (deposit) {
      return { purpose: 'deposit', reference, ...deposit, settled: !isOpen(deposit.status) };
    }
    const repayment = await this.prisma.repayment.findUnique({ where: { id: reference }, select });
    if (repayment) {
      return { purpose: 'repayment', reference, ...repayment, settled: !isOpen(repayment.status) };
    }
    const payout = await this.prisma.payout.findUnique({
      where: { providerReference: reference },
      select,
    });
    if (payout) {
      return { purpose: 'payout', reference, ...payout, settled: payout.status !== 'PENDING' };
    }
    return null;
  }

  /**
   * A deposit or repayment the provider confirmed is still unpaid past its expiry (MO4: the
   * sweep asked first). It stops counting as in flight; a late approval still settles it.
   * Returns whether this call changed it.
   */
  expire(actor: Actor, target: PaymentTarget, now: Date): Promise<boolean> {
    const where = { id: target.id, status: 'PENDING' as const, expiresAt: { lte: now } };
    const data = { status: 'EXPIRED' as const };
    return runInTransaction(this.prisma, async (tx) => {
      const updated =
        target.purpose === 'deposit'
          ? await tx.collateralDeposit.updateMany({ where, data })
          : await tx.repayment.updateMany({ where, data });
      if (updated.count !== 1) return false;
      await recordChange(tx, actor, {
        action: `${target.purpose}.expired`,
        entityType: target.purpose,
        entityId: target.id,
        data: { accountId: target.accountId, amountCents: centsToString(target.amountCents) },
      });
      return true;
    });
  }

  /** Applies what the provider says about OUR payment; PENDING there is not confirmed here. */
  async settle(actor: Actor, target: PaymentTarget, payment: ProviderPayment): Promise<void> {
    if (target.purpose === 'payout') {
      // Payouts have their own attempts and references: one path for webhook and worker.
      await this.payouts.applyResult(actor, target.id, payment);
      return;
    }
    assertPaymentMatches(payment, {
      reference: target.reference,
      amountCents: target.amountCents,
      purpose: target.purpose,
    });
    if (payment.status === 'PENDING') throw new AppHttpException('payment.not_confirmed');
    const succeeded = payment.status === 'SUCCEEDED';
    await runInTransaction(this.prisma, async (tx) => {
      const account = await lockAndRead(tx, { accountId: target.accountId });
      if (target.purpose === 'deposit') {
        await this.settleDeposit({ tx, actor, account, target, succeeded });
      } else {
        await this.settleRepayment({ tx, actor, account, target, succeeded });
      }
    });
  }

  private async settleDeposit(input: SettleInput): Promise<void> {
    const { tx, actor, account, target } = input;
    const deposit = await tx.collateralDeposit.findUniqueOrThrow({
      where: { id: target.id },
      select: { status: true, amountCents: true, limitRatioBps: true },
    });
    if (!isOpen(deposit.status)) return;
    const now = new Date();
    await tx.collateralDeposit.update({
      where: { id: target.id },
      data: input.succeeded ? { status: 'CONFIRMED', confirmedAt: now } : { status: 'FAILED' },
      select: { id: true },
    });
    if (!input.succeeded) {
      await recordFailure(tx, actor, 'deposit', target);
      return;
    }
    await postJournalEntry(tx, {
      kind: 'collateral_deposit',
      accountId: account.id,
      description: 'Collateral deposit confirmed',
      postings: transfer({
        debit: LEDGER.cashClearing,
        credit: LEDGER.collateral(account.id),
        amountCents: deposit.amountCents,
      }),
    });
    const data = { accountId: account.id, amountCents: centsToString(deposit.amountCents) };
    // Over the cap only when a deposit that had expired is approved late: the cap counted it
    // while it was in flight, then let other deposits take its place.
    const overCap = account.collateralCents + deposit.amountCents > MAX_ACCOUNT_COLLATERAL_CENTS;
    if (account.status === 'CLOSED' || overCap) {
      // The money cannot become collateral: it goes straight back to the customer.
      await this.refundLateDeposit(tx, actor, account.id, deposit.amountCents);
      await recordChange(tx, actor, {
        action: 'deposit.confirmed',
        entityType: 'deposit',
        entityId: target.id,
        data: { ...data, refunded: true },
      });
      return;
    }
    // MO5: the ratio stored with the deposit, never today's policy.
    const limitIncrease = limitForDeposit(deposit.amountCents, deposit.limitRatioBps);
    const activating = account.status === 'PENDING_COLLATERAL';
    await tx.account.update({
      where: { id: account.id },
      data: {
        collateralCents: { increment: deposit.amountCents },
        creditLimitCents: { increment: limitIncrease },
        ...(activating ? { status: 'ACTIVE', activatedAt: now, ...issueCard(now) } : {}),
      },
      select: { id: true },
    });
    await recordChange(tx, actor, {
      action: 'deposit.confirmed',
      entityType: 'deposit',
      entityId: target.id,
      data: { ...data, limitIncreaseCents: centsToString(limitIncrease) },
    });
    if (activating) {
      await recordChange(tx, actor, {
        action: 'account.activated',
        entityType: 'account',
        entityId: account.id,
        data: { creditLimitCents: centsToString(account.creditLimitCents + limitIncrease) },
      });
    }
  }

  private async refundLateDeposit(tx: Tx, actor: Actor, accountId: string, amount: bigint) {
    await postJournalEntry(tx, {
      kind: 'collateral_released',
      accountId,
      description: 'Collateral received after close, returned',
      postings: transfer({
        debit: LEDGER.collateral(accountId),
        credit: LEDGER.cashClearing,
        amountCents: amount,
      }),
    });
    await requestPayout(tx, actor, { accountId, amountCents: amount, reason: 'deposit_refund' });
  }

  private async settleRepayment(input: SettleInput): Promise<void> {
    const { tx, actor, account, target } = input;
    const repayment = await tx.repayment.findUniqueOrThrow({
      where: { id: target.id },
      select: { status: true, amountCents: true },
    });
    if (!isOpen(repayment.status)) return;
    if (!input.succeeded) {
      await tx.repayment.update({
        where: { id: target.id },
        data: { status: 'FAILED' },
        select: { id: true },
      });
      await recordFailure(tx, actor, 'repayment', target);
      return;
    }
    const applied = minCents(repayment.amountCents, account.postedDebtCents);
    const excess = repayment.amountCents - applied;
    await tx.repayment.update({
      where: { id: target.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), appliedCents: applied },
      select: { id: true },
    });
    if (applied > 0n) {
      await postJournalEntry(tx, {
        kind: 'repayment',
        accountId: account.id,
        description: 'Repayment confirmed',
        postings: transfer({
          debit: LEDGER.cashClearing,
          credit: LEDGER.receivable(account.id),
          amountCents: applied,
        }),
      });
      await tx.account.update({
        where: { id: account.id },
        data: { postedDebtCents: { decrement: applied } },
        select: { id: true },
      });
    }
    if (excess > 0n) {
      // Debt fell (e.g. the close applied collateral) while this payment was in flight.
      await requestPayout(tx, actor, {
        accountId: account.id,
        amountCents: excess,
        reason: 'repayment_refund',
      });
    }
    await recordChange(tx, actor, {
      action: 'repayment.confirmed',
      entityType: 'repayment',
      entityId: target.id,
      data: {
        accountId: account.id,
        appliedCents: centsToString(applied),
        refundedCents: centsToString(excess),
      },
    });
  }
}

interface SettleInput {
  tx: Tx;
  actor: Actor;
  account: AccountRow;
  target: PaymentTarget;
  succeeded: boolean;
}

async function recordFailure(tx: Tx, actor: Actor, entityType: string, target: PaymentTarget) {
  await recordChange(tx, actor, {
    action: `${entityType}.failed`,
    entityType,
    entityId: target.id,
    data: { accountId: target.accountId, amountCents: centsToString(target.amountCents) },
  });
}
