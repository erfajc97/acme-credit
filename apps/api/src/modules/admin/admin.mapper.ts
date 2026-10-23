import type {
  AdminAccount,
  AdminAuthorization,
  AuditLogEntry,
  JournalEntry,
} from '@acme/contracts';
import type { Prisma } from '../../generated/prisma/client';
import { centsToString } from '../../core/money/money';
import { accountSelect, toAccountBalances } from '../accounts/account.mapper';
import { authorizationSelect, toAuthorization } from '../authorizations/authorization.mapper';

export const adminAccountSelect = {
  ...accountSelect,
  customer: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.AccountSelect;

type AdminAccountRow = Prisma.AccountGetPayload<{ select: typeof adminAccountSelect }>;

export function toAdminAccount(row: AdminAccountRow): AdminAccount {
  return {
    id: row.id,
    status: row.status,
    currency: 'USD',
    ...toAccountBalances(row),
    openedAt: row.openedAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    customer: { id: row.customer.id, email: row.customer.email, fullName: row.customer.fullName },
    cardLast4: row.cardLast4,
    frozenBy: row.frozenBy,
    freezeReason: row.freezeReason,
  };
}

const customerSelect = { id: true, email: true, fullName: true } as const;

/** An invalid-card decline has no account, hence no customer. */
export const adminAuthorizationSelect = {
  ...authorizationSelect,
  account: { select: { customer: { select: customerSelect } } },
} satisfies Prisma.AuthorizationSelect;

type AdminAuthorizationRow = Prisma.AuthorizationGetPayload<{
  select: typeof adminAuthorizationSelect;
}>;

export function toAdminAuthorization(row: AdminAuthorizationRow): AdminAuthorization {
  const customer = row.account?.customer ?? null;
  return {
    ...toAuthorization(row),
    customer: customer
      ? { id: customer.id, email: customer.email, fullName: customer.fullName }
      : null,
  };
}

export const journalEntrySelect = {
  id: true,
  kind: true,
  accountId: true,
  description: true,
  createdAt: true,
  postings: {
    select: { ledgerAccount: true, amountCents: true },
    orderBy: [{ amountCents: 'desc' }, { id: 'asc' }],
  },
} satisfies Prisma.JournalEntrySelect;

type JournalEntryRow = Prisma.JournalEntryGetPayload<{ select: typeof journalEntrySelect }>;

export function toJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    kind: row.kind,
    accountId: row.accountId,
    description: row.description,
    postings: row.postings.map((posting) => ({
      ledgerAccount: posting.ledgerAccount,
      amountCents: centsToString(posting.amountCents),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

export const auditLogSelect = {
  id: true,
  actorType: true,
  actorId: true,
  action: true,
  entityType: true,
  entityId: true,
  requestId: true,
  data: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

type AuditLogRow = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

export function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  const data =
    typeof row.data === 'object' && row.data !== null && !Array.isArray(row.data) ? row.data : {};
  return {
    id: row.id,
    actorType: row.actorType,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    requestId: row.requestId,
    data,
    createdAt: row.createdAt.toISOString(),
  };
}
