import type { Authorization, AuthorizationDetail, OrderLine } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable } from '@nestjs/common';
import type { DeclineReason, ReversalReason } from '../../generated/prisma/client';
import { recordChange, SYSTEM_ACTOR, type Actor } from '../../core/audit/record-change';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { lockAccountByCardToken } from '../../core/database/account-lock';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { runInTransaction, type Tx } from '../../core/database/transaction';
import { paginate, type Page, type PageInput } from '../../core/http/pagination';
import {
  IdempotencyService,
  type IdempotentRequest,
} from '../../core/idempotency/idempotency.service';
import { idempotencyScope } from '../../core/idempotency/scope';
import { LEDGER, postJournalEntry, transfer } from '../../core/ledger/ledger';
import { centsFrom, centsToString } from '../../core/money/money';
import { AccountsService } from '../accounts/accounts.service';
import { lockAndRead } from '../accounts/helpers/lock-and-read';
import {
  AUTHORIZATION_STEP_ACTIONS,
  authorizationSelect,
  toAuthorization,
  toAuthorizationDetail,
} from './authorization.mapper';
import {
  assertCapturable,
  assertLinesMatchAmount,
  assertReversible,
  declineReasonFor,
  holdExpiresAt,
  isHoldExpired,
  type HoldState,
} from './helpers/authorization-rules';

const CREATED = 201;
const OK = 200;
/** Expired holds released per sweep transaction; the rest wait for the next tick. */
const HOLD_SWEEP_BATCH = 50;

export interface AuthorizeInput {
  cardToken: string;
  amountCents: string;
  merchant: { name: string; mcc: string };
  /** Store purchases only: the priced lines, totalling amountCents. */
  items?: OrderLine[];
}

/**
 * Card authorizations from the network (R-03, ADR-0003). Every decision is taken inside the
 * transaction that holds the account row lock; the hold itself is a conditional update whose
 * row count is checked, and the DB CHECK is the last line of defence. Declines are stored too.
 */
@Injectable()
export class AuthorizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly accounts: AccountsService,
    @Inject(ENV) private readonly env: Pick<Env, 'HOLD_TTL_HOURS'>,
  ) {}

  async authorize(
    actor: Actor,
    request: IdempotentRequest,
    input: AuthorizeInput,
  ): Promise<Authorization> {
    const context = { ...request, scope: idempotencyScope(actor), body: input };
    const amount = centsFrom(input.amountCents);
    assertLinesMatchAmount(input.items, amount);
    return this.idempotency.execute(context, CREATED, async (tx) => {
      const accountId = await lockAccountByCardToken(tx, input.cardToken);
      const account = accountId
        ? await tx.account.findUniqueOrThrow({
            where: { id: accountId },
            select: {
              status: true,
              cardExpiresOn: true,
              creditLimitCents: true,
              heldCents: true,
              postedDebtCents: true,
            },
          })
        : null;
      const now = new Date();
      let declineReason = declineReasonFor(account, amount, now);
      if (declineReason === null && accountId && !(await placeHold(tx, accountId, amount))) {
        declineReason = 'insufficient_funds';
      }
      const created = await tx.authorization.create({
        data: {
          accountId,
          amountCents: amount,
          status: declineReason ? 'DECLINED' : 'APPROVED',
          declineReason,
          merchantName: input.merchant.name,
          merchantMcc: input.merchant.mcc,
          items: input.items ?? [],
          // MO5: the expiry is fixed at approval, never recomputed from today's policy.
          expiresAt: declineReason ? null : holdExpiresAt(now, this.env.HOLD_TTL_HOURS),
        },
        select: authorizationSelect,
      });
      await recordDecision(tx, actor, created.id, { accountId, amount, declineReason });
      return toAuthorization(created);
    });
  }

  capture(
    actor: Actor,
    request: IdempotentRequest,
    target: { authorizationId: string; amountCents: string },
  ): Promise<Authorization> {
    const context = {
      ...request,
      scope: idempotencyScope(actor),
      body: { amountCents: target.amountCents },
    };
    const capture = centsFrom(target.amountCents);
    return this.idempotency.execute(context, CREATED, async (tx) => {
      const { accountId, current } = await lockAuthorization(tx, target.authorizationId, () => {
        throw new AppHttpException('authorization.not_capturable');
      });
      assertCapturable(current, capture, new Date());
      const captured = await tx.authorization.update({
        where: { id: current.id },
        data: { status: 'CAPTURED', capturedCents: capture },
        select: authorizationSelect,
      });
      // The whole hold goes; the debt is what was actually captured.
      await tx.account.update({
        where: { id: accountId },
        data: {
          heldCents: { decrement: current.amountCents },
          postedDebtCents: { increment: capture },
        },
        select: { id: true },
      });
      await postJournalEntry(tx, {
        kind: 'purchase_capture',
        accountId,
        description: `Purchase at ${current.merchantName}`,
        postings: transfer({
          debit: LEDGER.receivable(accountId),
          credit: LEDGER.merchantSettlement,
          amountCents: capture,
        }),
      });
      await recordChange(tx, actor, {
        action: AUTHORIZATION_STEP_ACTIONS.captured,
        entityType: 'authorization',
        entityId: current.id,
        data: {
          accountId,
          authorizedCents: centsToString(current.amountCents),
          capturedCents: target.amountCents,
        },
      });
      return toAuthorization(captured);
    });
  }

  /** The network voids a hold (card-network reversal). */
  reverse(
    actor: Actor,
    request: IdempotentRequest,
    authorizationId: string,
  ): Promise<Authorization> {
    return this.releaseHold({
      actor,
      request,
      authorizationId,
      reason: 'network',
      status: CREATED,
    });
  }

  /** An admin releases a live hold the merchant will never capture (back office). */
  release(
    actor: Actor,
    request: IdempotentRequest,
    authorizationId: string,
  ): Promise<Authorization> {
    return this.releaseHold({
      actor,
      request,
      authorizationId,
      reason: 'admin_release',
      status: OK,
    });
  }

  /**
   * The worker's sweep: releases approved holds past their expiry, a batch per transaction.
   * The accounts are locked first (ADR-0003 order) with SKIP LOCKED, so a card busy with a
   * purchase or another sweeper is simply left for the next tick. Each hold is re-read under
   * the lock and released through the SAME path as a reversal. Returns how many were released.
   */
  releaseExpiredHolds(now = new Date()): Promise<number> {
    return runInTransaction(this.prisma, async (tx) => {
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT a.id::text AS id
          FROM authorizations a
          JOIN accounts ac ON ac.id = a.account_id
         WHERE a.status = 'APPROVED' AND a.expires_at <= ${now}
         ORDER BY a.expires_at, a.id
         LIMIT ${HOLD_SWEEP_BATCH}
         FOR UPDATE OF ac SKIP LOCKED`;
      let released = 0;
      // Bounded by HOLD_SWEEP_BATCH; each release is the shared reversal (no bulk shortcut).
      for (const hold of due) {
        const current = await tx.authorization.findUniqueOrThrow({
          where: { id: hold.id },
          select: lockedHoldSelect,
        });
        if (current.status !== 'APPROVED' || !isHoldExpired(current.expiresAt, now)) continue;
        await reverseLockedHold(tx, SYSTEM_ACTOR, { current, reason: 'expired' });
        released += 1;
      }
      return released;
    });
  }

  private releaseHold(input: {
    actor: Actor;
    request: IdempotentRequest;
    authorizationId: string;
    reason: ReversalReason;
    status: number;
  }): Promise<Authorization> {
    const context = { ...input.request, scope: idempotencyScope(input.actor), body: {} };
    return this.idempotency.execute(context, input.status, async (tx) => {
      const { current } = await lockAuthorization(tx, input.authorizationId, () => {
        throw new AppHttpException('authorization.not_reversible');
      });
      assertReversible(current);
      return toAuthorization(
        await reverseLockedHold(tx, input.actor, { current, reason: input.reason }),
      );
    });
  }

  async listForCustomer(
    customerId: string,
    accountId: string,
    query: PageInput,
  ): Promise<Page<Authorization>> {
    // Independent reads: the page is only returned once ownership is confirmed (404 otherwise).
    const [, page] = await Promise.all([
      this.accounts.assertOwned(customerId, accountId),
      this.listForAccount(accountId, query),
    ]);
    return page;
  }

  /** One purchase of the customer's own account; anyone else's is 404 (A7, A14). */
  async getForCustomer(
    customerId: string,
    accountId: string,
    authorizationId: string,
  ): Promise<AuthorizationDetail> {
    const [row, steps] = await Promise.all([
      this.prisma.authorization.findFirst({
        where: { id: authorizationId, accountId, account: { customerId } },
        select: authorizationSelect,
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'authorization',
          entityId: authorizationId,
          action: {
            in: [AUTHORIZATION_STEP_ACTIONS.captured, AUTHORIZATION_STEP_ACTIONS.reversed],
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { action: true, createdAt: true },
      }),
    ]);
    if (!row) throw new AppHttpException('common.not_found');
    return toAuthorizationDetail({ ...row, accountId }, steps);
  }

  /**
   * No ownership filter: callers gate it (customer: assertOwned; admin: role). `search` (the
   * back office's `?q=`) only narrows the account's own rows: it sits next to `accountId`.
   */
  listForAccount(
    accountId: string,
    query: PageInput & { search?: Prisma.AuthorizationWhereInput },
  ): Promise<Page<Authorization>> {
    const where: Prisma.AuthorizationWhereInput = { AND: [{ accountId }, query.search ?? {}] };
    return paginate({
      query,
      count: () => this.prisma.authorization.count({ where }),
      read: (window) =>
        this.prisma.authorization.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...window,
          select: authorizationSelect,
        }),
      map: toAuthorization,
    });
  }
}

/**
 * The hold: `held += amount` only while the account is ACTIVE and the amount still fits
 * (MO3, ADR-0003). Returns false when the row did not qualify.
 */
async function placeHold(tx: Tx, accountId: string, amount: bigint): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE accounts
       SET held_cents = held_cents + ${amount}, updated_at = now()
     WHERE id = ${accountId}::uuid
       AND status = 'ACTIVE'
       AND credit_limit_cents - held_cents - posted_debt_cents >= ${amount}`;
  return updated === 1;
}

const lockedHoldSelect = {
  id: true,
  accountId: true,
  status: true,
  amountCents: true,
  merchantName: true,
  expiresAt: true,
  reversalReason: true,
} as const;

/**
 * THE reversal of a live hold (network void, admin release, expiry): the held amount goes back
 * to available, the reason is stored, and the change is audited with its outbox event. The
 * caller holds the account lock and has checked the hold is APPROVED.
 */
async function reverseLockedHold(
  tx: Tx,
  actor: Actor,
  input: { current: HoldState & { id: string; accountId: string | null }; reason: ReversalReason },
) {
  const { current, reason } = input;
  const accountId = current.accountId;
  if (!accountId) throw new AppHttpException('authorization.not_reversible');
  const reversed = await tx.authorization.update({
    where: { id: current.id },
    data: { status: 'REVERSED', reversalReason: reason },
    select: authorizationSelect,
  });
  await tx.account.update({
    where: { id: accountId },
    data: { heldCents: { decrement: current.amountCents } },
    select: { id: true },
  });
  await recordChange(tx, actor, {
    action: AUTHORIZATION_STEP_ACTIONS.reversed,
    entityType: 'authorization',
    entityId: current.id,
    data: { accountId, releasedCents: centsToString(current.amountCents), reason },
  });
  return reversed;
}

/**
 * Locks the account of an authorization, then reads the authorization under that lock. The
 * first read only fetches the immutable account id: the lock is still the first statement
 * that decides anything. A declined authorization has no account and no hold.
 */
async function lockAuthorization(tx: Tx, authorizationId: string, onDeclined: () => never) {
  const found = await tx.authorization.findUnique({
    where: { id: authorizationId },
    select: { accountId: true },
  });
  if (!found) throw new AppHttpException('common.not_found');
  if (!found.accountId) onDeclined();
  const accountId = found.accountId;
  await lockAndRead(tx, { accountId });
  const current = await tx.authorization.findUniqueOrThrow({
    where: { id: authorizationId },
    select: lockedHoldSelect,
  });
  return { accountId, current: { ...current, accountId } };
}

async function recordDecision(
  tx: Tx,
  actor: Actor,
  authorizationId: string,
  decision: { accountId: string | null; amount: bigint; declineReason: DeclineReason | null },
) {
  await recordChange(tx, actor, {
    action: decision.declineReason ? 'authorization.declined' : 'authorization.approved',
    entityType: 'authorization',
    entityId: authorizationId,
    data: {
      accountId: decision.accountId,
      amountCents: centsToString(decision.amount),
      declineReason: decision.declineReason,
    },
  });
}
