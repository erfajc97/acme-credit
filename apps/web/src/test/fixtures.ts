import type {
  Account,
  Activity,
  Authorization,
  AuthorizationDetail,
  Deposit,
  Repayment,
  Session,
} from '@acme/contracts';

export const USER_ID = '0b6d7a52-3a8f-4d0e-9c1b-7a2f4e6d8c10';
export const ACCOUNT_ID = '5f3e2d1c-4b5a-4968-8776-a5b4c3d2e1f0';

export const SESSION: Session = {
  accessToken: 'access-1',
  expiresInSeconds: 900,
  user: { id: USER_ID, email: 'ada@example.test', fullName: 'Ada Lovelace', role: 'customer' },
};

/** An active account whose amounts all differ (FT5): 500.00 limit, 40.00 held, 120.00 owed. */
export function accountFixture(overrides: Partial<Account> = {}): Account {
  return {
    id: ACCOUNT_ID,
    status: 'ACTIVE',
    currency: 'USD',
    collateralCents: '50000',
    creditLimitCents: '50000',
    heldCents: '4000',
    postedDebtCents: '12000',
    availableCents: '34000',
    card: { last4: '4242', token: 'tok_demo_4242', expiresMonth: '08/29' },
    frozenBy: null,
    openedAt: '2026-10-01T10:00:00.000Z',
    activatedAt: '2026-10-01T10:05:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

export const PENDING_ACCOUNT = accountFixture({
  status: 'PENDING_COLLATERAL',
  collateralCents: '0',
  creditLimitCents: '0',
  heldCents: '0',
  postedDebtCents: '0',
  availableCents: '0',
  card: null,
  activatedAt: null,
});

export function depositFixture(overrides: Partial<Deposit> = {}): Deposit {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    accountId: ACCOUNT_ID,
    amountCents: '25050',
    status: 'PENDING',
    limitRatioBps: 10000,
    checkout: { paymentId: 'pay_1', approveUrl: 'http://localhost:3001/pay/pay_1' },
    createdAt: '2026-10-21T10:00:00.000Z',
    confirmedAt: null,
    expiresAt: '2026-10-21T10:30:00.000Z',
    ...overrides,
  };
}

export function repaymentFixture(overrides: Partial<Repayment> = {}): Repayment {
  return {
    id: '9b2f4c1e-2d3a-4f5b-8c6d-7e8f9a0b1c2d',
    accountId: ACCOUNT_ID,
    amountCents: '5025',
    status: 'PENDING',
    checkout: { paymentId: 'pay_2', approveUrl: 'http://localhost:3001/pay/pay_2' },
    createdAt: '2026-10-21T11:00:00.000Z',
    confirmedAt: null,
    expiresAt: '2026-10-21T11:30:00.000Z',
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
    items: [],
    expiresAt: '2026-10-28T12:00:00.000Z',
    reversalReason: null,
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  };
}

/** The order detail the API answers for authorizationFixture() (GET …/authorizations/:id). */
export function authorizationDetailFixture(
  overrides: Partial<AuthorizationDetail> = {},
): AuthorizationDetail {
  const base = authorizationFixture();
  return {
    id: base.id,
    accountId: ACCOUNT_ID,
    status: base.status,
    declineReason: null,
    merchantName: base.merchantName,
    merchantMcc: base.merchantMcc,
    amountCents: base.amountCents,
    capturedCents: base.capturedCents,
    itemCount: 0,
    items: [],
    timeline: {
      createdAt: base.createdAt,
      approvedAt: base.createdAt,
      declinedAt: null,
      capturedAt: null,
      reversedAt: null,
    },
    expiresAt: base.expiresAt,
    reversalReason: null,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    ...overrides,
  };
}

export function activityFixture(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    type: 'purchase',
    status: 'POSTED',
    amountCents: '1250',
    description: 'Purchase at Corner Grocery', // the API's own shape (accounts.service describe)
    merchantName: 'Corner Grocery',
    itemCount: 0,
    items: [],
    createdAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  };
}

/** A numbered page as the API answers it (packages/contracts pageSchema); one page by default. */
export const page = <T>(
  items: T[],
  {
    current = 1,
    pageSize = 10,
    total = items.length,
  }: { current?: number; pageSize?: number; total?: number } = {},
) => ({
  items,
  page: current,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
