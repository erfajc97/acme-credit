import type {
  AdminAccount,
  AdminAccountDetail,
  AdminAuthorization,
  AdminPayout,
  AuditLogEntry,
  Authorization,
  Dashboard,
  JournalEntry,
  Session,
} from '@acme/contracts';

export const ADMIN_ID = '0b6d7a52-3a8f-4d0e-9c1b-7a2f4e6d8c10';
export const ACCOUNT_ID = '5f3e2d1c-4b5a-4968-8776-a5b4c3d2e1f0';
export const OTHER_ACCOUNT_ID = '6a4f3e2d-5c6b-4a79-9887-b6c5d4e3f2a1';
export const CUSTOMER_ID = '1c7e8b63-4b9a-4e1f-8d2c-8b3a5f7e9d21';

export const SESSION: Session = {
  accessToken: 'access-1',
  expiresInSeconds: 900,
  user: { id: ADMIN_ID, email: 'grace@acme.test', fullName: 'Grace Hopper', role: 'admin' },
};

/** An active account whose amounts all differ (FT5): 500.00 limit, 40.00 held, 120.00 owed. */
export function adminAccountFixture(overrides: Partial<AdminAccount> = {}): AdminAccount {
  return {
    id: ACCOUNT_ID,
    status: 'ACTIVE',
    currency: 'USD',
    collateralCents: '50000',
    creditLimitCents: '50000',
    heldCents: '4000',
    postedDebtCents: '12000',
    availableCents: '34000',
    openedAt: '2026-10-01T10:00:00.000Z',
    activatedAt: '2026-10-01T10:05:00.000Z',
    closedAt: null,
    customer: { id: CUSTOMER_ID, email: 'ada@example.test', fullName: 'Ada Lovelace' },
    cardLast4: '4242',
    frozenBy: null,
    freezeReason: null,
    ...overrides,
  };
}

export function dashboardFixture(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    accountsByStatus: { PENDING_COLLATERAL: 3, ACTIVE: 1204, FROZEN: 7, CLOSED: 41 },
    collateralHeldCents: '61250000',
    creditLimitCents: '60125050',
    heldCents: '432175',
    receivableCents: '1988033',
    authorizationsLast24h: { approved: 318, declined: 26 },
    ledgerTrialBalanceCents: '0',
    reconciliation: { accountsChecked: 1255, mismatches: 0, mismatchedAccountIds: [] },
    ...overrides,
  };
}

export function authorizationFixture(overrides: Partial<Authorization> = {}): Authorization {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    accountId: ACCOUNT_ID,
    amountCents: '1250',
    capturedCents: '0',
    status: 'APPROVED',
    declineReason: null,
    merchantName: 'Corner Grocery',
    merchantMcc: '5411',
    // Order lines of a store purchase (contract field); empty for a plain card purchase.
    items: [],
    expiresAt: '2026-10-28T12:00:00.000Z',
    reversalReason: null,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  };
}

export function journalEntryFixture(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f',
    kind: 'purchase_capture',
    accountId: ACCOUNT_ID,
    description: 'Corner Grocery',
    postings: [
      { ledgerAccount: `receivable:${ACCOUNT_ID}`, amountCents: '1250' },
      { ledgerAccount: 'merchant_settlement', amountCents: '-1250' },
    ],
    createdAt: '2026-10-21T12:30:00.000Z',
    ...overrides,
  };
}

export function auditEntryFixture(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70',
    actorType: 'admin',
    actorId: ADMIN_ID,
    action: 'account.frozen',
    entityType: 'account',
    entityId: ACCOUNT_ID,
    requestId: 'req-7f3a',
    data: {},
    createdAt: '2026-10-21T13:00:00.000Z',
    ...overrides,
  };
}

/**
 * One numbered page as the API answers it (`{ items, page, pageSize, total, totalPages }`). By
 * default the whole list is these items on page 1; pass `total` / `page` for a longer list.
 */
export function page<T>(
  items: T[],
  { page = 1, total = items.length }: { page?: number; total?: number } = {},
) {
  return { items, page, pageSize: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) };
}

/** A store order of the in-wallet store: three lines whose subtotals all differ (FT5). */
export const STORE_ITEMS: AdminAuthorization['items'] = [
  { sku: 'cafe-americano', name: 'Americano', quantity: 2, unitCents: '350' },
  { sku: 'pan-dulce', name: 'Concha', quantity: 3, unitCents: '1225' },
  { sku: 'jugo', name: 'Orange juice', quantity: 1, unitCents: '4999' },
];

/** One purchase of the wallet as GET /admin/authorizations returns it (customer attached). */
export function adminAuthorizationFixture(
  overrides: Partial<AdminAuthorization> = {},
): AdminAuthorization {
  return {
    ...authorizationFixture({
      id: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a81',
      amountCents: '9374',
      merchantName: 'Taquería El Sol',
      merchantMcc: '5812',
      items: STORE_ITEMS,
    }),
    customer: { id: CUSTOMER_ID, email: 'ada@example.test', fullName: 'Ada Lovelace' },
    ...overrides,
  };
}

/** The account page's read (GET /admin/accounts/:id): the account plus its payouts. */
export function adminAccountDetailFixture(
  overrides: Partial<AdminAccountDetail> = {},
): AdminAccountDetail {
  return { ...adminAccountFixture(), payouts: [], ...overrides };
}

/** A payout that failed for good after three attempts; every amount and id unique (FT5). */
export function adminPayoutFixture(overrides: Partial<AdminPayout> = {}): AdminPayout {
  return {
    id: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d14',
    accountId: ACCOUNT_ID,
    amountCents: '38000',
    reason: 'collateral_release',
    status: 'FAILED',
    attempts: 3,
    providerPaymentId: 'pay_7Hq2',
    lastError: 'provider_rejected',
    nextAttemptAt: null,
    createdAt: '2026-10-21T14:00:00.000Z',
    sentAt: null,
    failedAt: '2026-10-21T16:30:00.000Z',
    customer: { id: CUSTOMER_ID, email: 'ada@example.test', fullName: 'Ada Lovelace' },
    ...overrides,
  };
}
