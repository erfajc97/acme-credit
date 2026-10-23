import type { Deposit, ProviderPayment, Repayment } from '@acme/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { recordChange, type Actor } from '../../core/audit/record-change';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { PrismaService } from '../../core/database/prisma.service';
import { runInTransaction, type Tx } from '../../core/database/transaction';
import { paginate, type Page, type PageInput } from '../../core/http/pagination';
import {
  IdempotencyService,
  replayResponse,
  type IdempotentRequest,
} from '../../core/idempotency/idempotency.service';
import { idempotencyScope } from '../../core/idempotency/scope';
import { centsFrom, centsToString } from '../../core/money/money';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../core/payment-provider/payment-provider.port';
import { AccountsService } from '../accounts/accounts.service';
import { lockAndRead } from '../accounts/helpers/lock-and-read';
import {
  assertDepositAllowed,
  assertRepaymentAllowed,
  assertWithinCollateralCap,
  COLLATERAL_LIMIT_RATIO_BPS,
  paymentExpiresAt,
} from './helpers/payment-rules';
import { depositSelect, repaymentSelect, toDeposit, toRepayment } from './payment.mapper';

const CREATED = 201;

export interface PaymentRequestInput {
  actor: Actor & { id: string };
  request: IdempotentRequest;
  accountId: string;
  amountCents: string;
}

/** Steps that differ between a deposit and a repayment; the flow around them is shared. */
interface CheckoutFlow<Body extends Prisma.InputJsonValue> {
  purpose: 'deposit' | 'repayment';
  /** Validates under the account lock and inserts the PENDING row; returns its id. */
  createRow: (tx: Tx) => Promise<string>;
  /** Stores the provider's checkout on the row and maps the response. */
  attachCheckout: (tx: Tx, rowId: string, payment: ProviderPayment) => Promise<Body>;
  amountOf: (rowId: string) => Promise<bigint>;
}

/**
 * Customer-initiated money in: collateral deposits (R-01, R-55) and repayments (R-04). The row
 * is created under the account lock, the provider payment is created AFTER commit with our row
 * id as its reference (idempotent at the provider), and the response with the checkout is
 * stored with the key. If the provider is down, the key is parked RETRYABLE with the row id, so
 * the client's retry resumes that row instead of creating a second one.
 */
@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly accounts: AccountsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Pick<Env, 'PENDING_PAYMENT_TTL_MINUTES'>,
  ) {}

  requestDeposit(input: PaymentRequestInput): Promise<Deposit> {
    const amount = centsFrom(input.amountCents);
    return this.withCheckout(input, {
      purpose: 'deposit',
      createRow: async (tx) => {
        const account = await lockAndRead(tx, {
          accountId: input.accountId,
          ownerId: input.actor.id,
        });
        assertDepositAllowed(account.status, amount);
        const now = new Date();
        const pending = await tx.collateralDeposit.aggregate({
          where: { accountId: account.id, status: 'PENDING', expiresAt: { gt: now } },
          _sum: { amountCents: true },
        });
        assertWithinCollateralCap({
          collateral: account.collateralCents,
          pendingDeposits: pending._sum.amountCents ?? 0n,
          amount,
        });
        const deposit = await tx.collateralDeposit.create({
          data: {
            accountId: account.id,
            amountCents: amount,
            limitRatioBps: COLLATERAL_LIMIT_RATIO_BPS,
            expiresAt: paymentExpiresAt(now, this.env.PENDING_PAYMENT_TTL_MINUTES),
          },
          select: { id: true },
        });
        await recordChange(tx, input.actor, {
          action: 'deposit.requested',
          entityType: 'deposit',
          entityId: deposit.id,
          data: { accountId: account.id, amountCents: input.amountCents },
        });
        return deposit.id;
      },
      attachCheckout: async (tx, id, payment) =>
        toDeposit(
          await tx.collateralDeposit.update({
            where: { id },
            data: { providerPaymentId: payment.id, approveUrl: payment.approveUrl },
            select: depositSelect,
          }),
        ),
      amountOf: async (id) =>
        (
          await this.prisma.collateralDeposit.findUniqueOrThrow({
            where: { id },
            select: { amountCents: true },
          })
        ).amountCents,
    });
  }

  requestRepayment(input: PaymentRequestInput): Promise<Repayment> {
    const amount = centsFrom(input.amountCents);
    return this.withCheckout(input, {
      purpose: 'repayment',
      createRow: async (tx) => {
        const account = await lockAndRead(tx, {
          accountId: input.accountId,
          ownerId: input.actor.id,
        });
        const now = new Date();
        // Past its expiry a repayment no longer blocks: if the bank still pays it, the part
        // the debt no longer needs is refunded when it settles.
        const pending = await tx.repayment.aggregate({
          where: { accountId: account.id, status: 'PENDING', expiresAt: { gt: now } },
          _sum: { amountCents: true },
        });
        assertRepaymentAllowed({
          amount,
          postedDebt: account.postedDebtCents,
          pendingRepayments: pending._sum.amountCents ?? 0n,
        });
        const repayment = await tx.repayment.create({
          data: {
            accountId: account.id,
            amountCents: amount,
            expiresAt: paymentExpiresAt(now, this.env.PENDING_PAYMENT_TTL_MINUTES),
          },
          select: { id: true },
        });
        await recordChange(tx, input.actor, {
          action: 'repayment.requested',
          entityType: 'repayment',
          entityId: repayment.id,
          data: { accountId: account.id, amountCents: input.amountCents },
        });
        return repayment.id;
      },
      attachCheckout: async (tx, id, payment) =>
        toRepayment(
          await tx.repayment.update({
            where: { id },
            data: { providerPaymentId: payment.id, approveUrl: payment.approveUrl },
            select: repaymentSelect,
          }),
        ),
      amountOf: async (id) =>
        (
          await this.prisma.repayment.findUniqueOrThrow({
            where: { id },
            select: { amountCents: true },
          })
        ).amountCents,
    });
  }

  async listDeposits(
    customerId: string,
    accountId: string,
    query: PageInput,
  ): Promise<Page<Deposit>> {
    const where = { accountId, providerPaymentId: { not: null } };
    // Independent reads: the page is only returned once ownership is confirmed (404 otherwise).
    const [, page] = await Promise.all([
      this.accounts.assertOwned(customerId, accountId),
      paginate({
        query,
        count: () => this.prisma.collateralDeposit.count({ where }),
        read: (window) =>
          this.prisma.collateralDeposit.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...window,
            select: depositSelect,
          }),
        map: toDeposit,
      }),
    ]);
    return page;
  }

  async listRepayments(
    customerId: string,
    accountId: string,
    query: PageInput,
  ): Promise<Page<Repayment>> {
    const where = { accountId, providerPaymentId: { not: null } };
    // Independent reads: the page is only returned once ownership is confirmed (404 otherwise).
    const [, page] = await Promise.all([
      this.accounts.assertOwned(customerId, accountId),
      paginate({
        query,
        count: () => this.prisma.repayment.count({ where }),
        read: (window) =>
          this.prisma.repayment.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...window,
            select: repaymentSelect,
          }),
        map: toRepayment,
      }),
    ]);
    return page;
  }

  private async withCheckout<Body extends Prisma.InputJsonValue>(
    input: PaymentRequestInput,
    flow: CheckoutFlow<Body>,
  ): Promise<Body> {
    const context = {
      ...input.request,
      scope: idempotencyScope(input.actor),
      body: { amountCents: input.amountCents },
    };
    const start = await this.idempotency.begin(context);
    if (start.kind === 'replay') return replayResponse<Body>(start);
    try {
      const rowId =
        start.resourceId ??
        (await runInTransaction(this.prisma, async (tx) => {
          const id = await flow.createRow(tx);
          await this.idempotency.attachResource(tx, start, id);
          return id;
        }));
      // Outside any transaction (AN5): the provider is idempotent by our reference.
      const payment = await this.provider.createPayment({
        reference: rowId,
        amountCents: centsToString(await flow.amountOf(rowId)),
        purpose: flow.purpose,
      });
      return await runInTransaction(this.prisma, async (tx) => {
        const body = await flow.attachCheckout(tx, rowId, payment);
        await this.idempotency.complete(tx, start, CREATED, body);
        return body;
      });
    } catch (error) {
      await this.idempotency.fail(start, error);
      throw error;
    }
  }
}
