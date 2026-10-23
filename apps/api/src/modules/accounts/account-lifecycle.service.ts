import type { Account } from '@acme/contracts';
import { Injectable } from '@nestjs/common';
import type { FreezeReason, Prisma } from '../../generated/prisma/client';
import { recordChange, type Actor } from '../../core/audit/record-change';
import type { Tx } from '../../core/database/transaction';
import {
  IdempotencyService,
  type IdempotentRequest,
} from '../../core/idempotency/idempotency.service';
import { idempotencyScope } from '../../core/idempotency/scope';
import { LEDGER, postJournalEntry, transfer } from '../../core/ledger/ledger';
import { centsToString } from '../../core/money/money';
import { requestPayout } from '../payouts/helpers/request-payout';
import { accountSelect, toAccount } from './account.mapper';
import type { CloseAccountResponse } from './dto/account-responses';
import { lockAndRead, type AccountTarget } from './helpers/lock-and-read';
import {
  assertCanFreeze,
  assertCanUnfreeze,
  freezeActorOf,
  settleOnClose,
  type FreezeState,
  type Settlement,
} from './helpers/account-rules';

/** Why an admin may freeze a card (contract ADMIN_FREEZE_REASONS). */
export type AdminFreezeReason = Exclude<FreezeReason, 'customer_request'>;

const OK = 200;

/** Freeze, unfreeze and close: shared by the customer and the admin doors (G12). */
@Injectable()
export class AccountLifecycleService {
  constructor(private readonly idempotency: IdempotencyService) {}

  /** Records who froze the card and why: a customer cannot lift an admin's freeze. */
  freeze(
    actor: Actor,
    request: IdempotentRequest,
    target: AccountTarget,
    adminReason?: AdminFreezeReason,
  ): Promise<Account> {
    const by = freezeActorOf(actor.type);
    const reason: FreezeReason =
      by === 'ADMIN' ? (adminReason ?? 'admin_review') : 'customer_request';
    return this.changeStatus({
      actor,
      request,
      target,
      // An admin's reason is part of the request: the same key with another reason is a 409.
      body: adminReason ? { reason: adminReason } : {},
      check: (account) => assertCanFreeze(account, by),
      data: () => ({ status: 'FROZEN', frozenBy: by, freezeReason: reason, frozenAt: new Date() }),
      audit: { action: 'account.frozen', data: { to: 'FROZEN', frozenBy: by, reason } },
    });
  }

  unfreeze(actor: Actor, request: IdempotentRequest, target: AccountTarget): Promise<Account> {
    const by = freezeActorOf(actor.type);
    return this.changeStatus({
      actor,
      request,
      target,
      body: {},
      check: (account) => assertCanUnfreeze(account, by),
      data: () => ({ status: 'ACTIVE', frozenBy: null, freezeReason: null, frozenAt: null }),
      audit: { action: 'account.unfrozen', data: { to: 'ACTIVE' } },
    });
  }

  close(
    actor: Actor,
    request: IdempotentRequest,
    target: AccountTarget,
  ): Promise<CloseAccountResponse> {
    const context = { ...request, scope: idempotencyScope(actor), body: {} };
    return this.idempotency.execute(context, OK, async (tx) => {
      const account = await lockAndRead(tx, target);
      const settlement = settleOnClose(account);
      await this.postSettlement(tx, actor, account.id, settlement);
      const closed = await tx.account.update({
        where: { id: account.id },
        data: {
          status: 'CLOSED',
          collateralCents: 0n,
          creditLimitCents: 0n,
          postedDebtCents: account.postedDebtCents - settlement.appliedToDebtCents,
          closedAt: new Date(),
        },
        select: accountSelect,
      });
      const settlementJson = {
        collateralCents: centsToString(settlement.collateralCents),
        appliedToDebtCents: centsToString(settlement.appliedToDebtCents),
        releasedCents: centsToString(settlement.releasedCents),
      };
      await recordChange(tx, actor, {
        action: 'account.closed',
        entityType: 'account',
        entityId: account.id,
        data: { from: account.status, ...settlementJson },
      });
      return { account: toAccount(closed), settlement: settlementJson };
    });
  }

  private changeStatus(input: {
    actor: Actor;
    request: IdempotentRequest;
    target: AccountTarget;
    body: Prisma.InputJsonObject;
    check: (account: FreezeState) => void;
    data: () => Prisma.AccountUpdateInput;
    audit: { action: string; data: Prisma.InputJsonObject };
  }): Promise<Account> {
    const context = { ...input.request, scope: idempotencyScope(input.actor), body: input.body };
    return this.idempotency.execute(context, OK, async (tx) => {
      const account = await lockAndRead(tx, input.target);
      input.check(account);
      const updated = await tx.account.update({
        where: { id: account.id },
        data: input.data(),
        select: accountSelect,
      });
      await recordChange(tx, input.actor, {
        action: input.audit.action,
        entityType: 'account',
        entityId: account.id,
        data: { from: account.status, ...input.audit.data },
      });
      return toAccount(updated);
    });
  }

  /** Collateral pays the debt, the rest is released to the customer through a payout. */
  private async postSettlement(tx: Tx, actor: Actor, accountId: string, settlement: Settlement) {
    if (settlement.appliedToDebtCents > 0n) {
      await postJournalEntry(tx, {
        kind: 'collateral_applied',
        accountId,
        description: 'Collateral applied to the balance on close',
        postings: transfer({
          debit: LEDGER.collateral(accountId),
          credit: LEDGER.receivable(accountId),
          amountCents: settlement.appliedToDebtCents,
        }),
      });
    }
    if (settlement.releasedCents > 0n) {
      await postJournalEntry(tx, {
        kind: 'collateral_released',
        accountId,
        description: 'Collateral released on close',
        postings: transfer({
          debit: LEDGER.collateral(accountId),
          credit: LEDGER.cashClearing,
          amountCents: settlement.releasedCents,
        }),
      });
      await requestPayout(tx, actor, {
        accountId,
        amountCents: settlement.releasedCents,
        reason: 'collateral_release',
      });
    }
  }
}
