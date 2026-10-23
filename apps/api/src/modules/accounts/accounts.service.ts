import { itemCountOf, toPurchaseLines, type Account, type Activity } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Injectable } from '@nestjs/common';
import { recordChange, type Actor } from '../../core/audit/record-change';
import { PrismaService } from '../../core/database/prisma.service';
import {
  IdempotencyService,
  type IdempotentRequest,
} from '../../core/idempotency/idempotency.service';
import { idempotencyScope } from '../../core/idempotency/scope';
import { paginate, type Page, type PageInput } from '../../core/http/pagination';
import { centsToString } from '../../core/money/money';
import { toOrderLines } from '../authorizations/authorization.mapper';
import { accountSelect, toAccount } from './account.mapper';
import { ActivityRepository, type ActivityRow } from './activity.repository';

const CREATED = 201;

/** Legacy English summary ("Merchant · N items") kept for clients that still render it. */
function describe(row: ActivityRow, itemCount: number): string {
  if (!itemCount) return row.description;
  return `${row.description} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
}

function toActivity(row: ActivityRow): Activity {
  const lines = toOrderLines(row.items);
  const itemCount = itemCountOf(lines);
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amountCents: centsToString(row.amount_cents),
    description: describe(row, itemCount),
    merchantName: row.merchant_name,
    itemCount,
    items: toPurchaseLines(lines),
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly activity: ActivityRepository,
  ) {}

  /** Opens the customer's account, PENDING_COLLATERAL; one open account per customer. */
  open(actor: Actor & { id: string }, request: IdempotentRequest): Promise<Account> {
    const context = { ...request, scope: idempotencyScope(actor), body: {} };
    return this.idempotency.execute(context, CREATED, async (tx) => {
      // Serializes "check, then insert" per customer; the partial unique index backs it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`account-open:${actor.id}`}, 0))`;
      const open = await tx.account.findFirst({
        where: { customerId: actor.id, status: { not: 'CLOSED' } },
        select: { id: true },
      });
      if (open) throw new AppHttpException('account.already_open', { accountId: open.id });
      const created = await tx.account.create({
        data: { customerId: actor.id },
        select: accountSelect,
      });
      await recordChange(tx, actor, {
        action: 'account.opened',
        entityType: 'account',
        entityId: created.id,
        data: { status: created.status },
      });
      return toAccount(created);
    });
  }

  /** The customer's current account: the open one, else the latest closed one. */
  async getMine(customerId: string): Promise<Account> {
    const row = await this.prisma.account.findFirst({
      where: { customerId },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: accountSelect,
    });
    if (!row) throw new AppHttpException('common.not_found');
    return toAccount(row);
  }

  /** Ownership gate of the read routes: someone else's account is 404, never 403 (A7). */
  async assertOwned(customerId: string, accountId: string): Promise<void> {
    const owned = await this.prisma.account.findFirst({
      where: { id: accountId, customerId },
      select: { id: true },
    });
    if (!owned) throw new AppHttpException('common.not_found');
  }

  async listActivity(
    customerId: string,
    accountId: string,
    query: PageInput,
  ): Promise<Page<Activity>> {
    // Independent reads: the page is only returned once ownership is confirmed (404 otherwise).
    const [, page] = await Promise.all([
      this.assertOwned(customerId, accountId),
      paginate({
        query,
        count: () => this.activity.count(accountId),
        read: (window) => this.activity.list(accountId, window),
        map: toActivity,
      }),
    ]);
    return page;
  }
}
