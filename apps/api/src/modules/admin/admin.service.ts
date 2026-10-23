import {
  ACCOUNT_STATUSES,
  type AccountStatus,
  type AdminAccount,
  type AdminAccountDetail,
  type AdminAuthorization,
  type AdminPayout,
  type Authorization,
  type AuthorizationStatus,
  type AuditLogEntry,
  type Dashboard,
  type JournalEntry,
  type PayoutStatus,
} from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { paginate, type Page, type PageInput } from '../../core/http/pagination';
import { LedgerReconciliation, summarizeReconciliation } from '../../core/ledger/reconciliation';
import { centsToString } from '../../core/money/money';
import { AuthorizationsService } from '../authorizations/authorizations.service';
import { PayoutsService } from '../payouts/payouts.service';
import { AdminRepository } from './admin.repository';
import {
  adminAccountSelect,
  adminAuthorizationSelect,
  auditLogSelect,
  journalEntrySelect,
  toAdminAccount,
  toAdminAuthorization,
  toAuditLogEntry,
  toJournalEntry,
} from './admin.mapper';
import {
  accountSearch,
  auditLogSearch,
  authorizationSearch,
  journalEntrySearch,
  payoutSearch,
} from './helpers/admin-search';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Read-only back office (R-50, R-51); state changes go through AccountLifecycleService. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizations: AuthorizationsService,
    private readonly repository: AdminRepository,
    private readonly payouts: PayoutsService,
    private readonly reconciliation: LedgerReconciliation,
  ) {}

  async dashboard(): Promise<Dashboard> {
    // Independent read-only statements, so one round trip of latency instead of two.
    const [totals, balances] = await Promise.all([
      this.repository.dashboardTotals(new Date(Date.now() - DAY_MS)),
      this.reconciliation.balances(),
    ]);
    const accountsByStatus = Object.fromEntries(
      ACCOUNT_STATUSES.map((status) => [status, totals.accounts_by_status[status] ?? 0]),
    ) as Record<AccountStatus, number>;
    return {
      accountsByStatus,
      collateralHeldCents: centsToString(totals.collateral_cents),
      creditLimitCents: centsToString(totals.credit_limit_cents),
      heldCents: centsToString(totals.held_cents),
      receivableCents: centsToString(totals.posted_debt_cents),
      authorizationsLast24h: { approved: totals.approved, declined: totals.declined },
      ledgerTrialBalanceCents: centsToString(totals.trial_balance_cents),
      reconciliation: summarizeReconciliation(balances),
    };
  }

  listAccounts(
    query: PageInput & { status?: AccountStatus; q?: string },
  ): Promise<Page<AdminAccount>> {
    const where: Prisma.AccountWhereInput = {
      AND: [query.status ? { status: query.status } : {}, accountSearch(query.q) ?? {}],
    };
    return paginate({
      query,
      count: () => this.prisma.account.count({ where }),
      read: (window) =>
        this.prisma.account.findMany({
          where,
          orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
          ...window,
          select: adminAccountSelect,
        }),
      map: toAdminAccount,
    });
  }

  /** One account with its payouts: whether the money owed back to the customer landed. */
  async getAccount(accountId: string): Promise<AdminAccountDetail> {
    const [row, payouts] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: accountId }, select: adminAccountSelect }),
      this.payouts.listForAccount(accountId),
    ]);
    if (!row) throw new AppHttpException('common.not_found');
    return { ...toAdminAccount(row), payouts };
  }

  /** Every payout, newest first: what is pending, retried or failed for good (operations). */
  listPayouts(
    query: PageInput & { status?: PayoutStatus; q?: string },
  ): Promise<Page<AdminPayout>> {
    return this.payouts.listForAdmin({ ...query, search: payoutSearch(query.q) });
  }

  private async assertAccountExists(accountId: string): Promise<void> {
    const found = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true },
    });
    if (!found) throw new AppHttpException('common.not_found');
  }

  async accountAuthorizations(
    accountId: string,
    query: PageInput & { q?: string },
  ): Promise<Page<Authorization>> {
    const [, page] = await Promise.all([
      this.assertAccountExists(accountId),
      this.authorizations.listForAccount(accountId, {
        ...query,
        search: authorizationSearch(query.q),
      }),
    ]);
    return page;
  }

  /** Every purchase decision across accounts, newest first (operations view). */
  listAuthorizations(
    query: PageInput & { status?: AuthorizationStatus; q?: string },
  ): Promise<Page<AdminAuthorization>> {
    const where: Prisma.AuthorizationWhereInput = {
      AND: [query.status ? { status: query.status } : {}, authorizationSearch(query.q) ?? {}],
    };
    return paginate({
      query,
      count: () => this.prisma.authorization.count({ where }),
      read: (window) =>
        this.prisma.authorization.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...window,
          select: adminAuthorizationSelect,
        }),
      map: toAdminAuthorization,
    });
  }

  async ledger(query: PageInput & { accountId?: string; q?: string }): Promise<Page<JournalEntry>> {
    const where: Prisma.JournalEntryWhereInput = {
      AND: [
        query.accountId ? { accountId: query.accountId } : {},
        journalEntrySearch(query.q) ?? {},
      ],
    };
    // Independent reads: the page is only returned once the account is known to exist (404).
    const [, page] = await Promise.all([
      query.accountId ? this.assertAccountExists(query.accountId) : undefined,
      paginate({
        query,
        count: () => this.prisma.journalEntry.count({ where }),
        read: (window) =>
          this.prisma.journalEntry.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...window,
            select: journalEntrySelect,
          }),
        map: toJournalEntry,
      }),
    ]);
    return page;
  }

  auditLog(query: PageInput & { entityId?: string; q?: string }): Promise<Page<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      AND: [query.entityId ? { entityId: query.entityId } : {}, auditLogSearch(query.q) ?? {}],
    };
    return paginate({
      query,
      count: () => this.prisma.auditLog.count({ where }),
      read: (window) =>
        this.prisma.auditLog.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...window,
          select: auditLogSelect,
        }),
      map: toAuditLogEntry,
    });
  }
}
