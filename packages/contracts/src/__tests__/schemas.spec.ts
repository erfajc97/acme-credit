import { describe, expect, it } from 'vitest';
import {
  accountSchema,
  activitySchema,
  adminAccountsQuerySchema,
  amountRequestSchema,
  auditLogEntrySchema,
  authorizationSchema,
  closeAccountResponseSchema,
  dashboardSchema,
  RECONCILIATION_IDS_MAX,
  reconciliationSchema,
  depositSchema,
  journalEntrySchema,
  loginRequestSchema,
  networkAuthorizationRequestSchema,
  pageQuerySchema,
  pageSchema,
  providerPaymentSchema,
  providerWebhookSchema,
  purchaseRequestSchema,
  purchaseResultSchema,
  registerRequestSchema,
  repaymentSchema,
  sessionSchema,
} from '../index';

const ID = '7b0d0f8e-3c1a-4c55-9a0e-2b8f1f6c9d10';
const AT = '2026-10-21T12:00:00.000Z';

const account = {
  id: ID,
  status: 'ACTIVE',
  currency: 'USD',
  collateralCents: '50000',
  creditLimitCents: '50000',
  heldCents: '1000',
  postedDebtCents: '2000',
  availableCents: '47000',
  card: { last4: '4242', token: 'tok_abc', expiresMonth: '10/29' },
  frozenBy: null,
  openedAt: AT,
  activatedAt: AT,
  closedAt: null,
};

const checkout = { paymentId: 'pay_1', approveUrl: 'http://localhost:3001/provider/pay/pay_1' };

describe('contract schemas', () => {
  it('auth: normalises the email and enforces password bounds', () => {
    const parsed = registerRequestSchema.parse({
      email: '  Ana@Example.COM ',
      password: 'a'.repeat(8),
      fullName: 'Ana',
    });
    expect(parsed.email).toBe('ana@example.com');
    expect(
      registerRequestSchema.safeParse({ email: 'a@b.co', password: 'a'.repeat(7), fullName: 'A' })
        .success,
    ).toBe(false);
    expect(
      loginRequestSchema.safeParse({ email: 'a@b.co', password: 'x', audience: 'admin' }).success,
    ).toBe(true);
    expect(
      sessionSchema.safeParse({
        accessToken: 't',
        expiresInSeconds: 900,
        user: { id: ID, email: 'a@b.co', fullName: 'A', role: 'customer' },
      }).success,
    ).toBe(true);
  });

  it('accounts: account, deposit, repayment, settlement, activity, journal', () => {
    expect(accountSchema.parse(account).availableCents).toBe('47000');
    expect(accountSchema.safeParse({ ...account, heldCents: '-1' }).success).toBe(false);
    const deposit = {
      id: ID,
      accountId: ID,
      amountCents: '50000',
      status: 'PENDING',
      limitRatioBps: 10_000,
      checkout,
      createdAt: AT,
      confirmedAt: null,
      expiresAt: AT,
    };
    expect(depositSchema.safeParse(deposit).success).toBe(true);
    const { limitRatioBps, ...repayment } = deposit;
    expect(limitRatioBps).toBe(10_000);
    expect(repaymentSchema.safeParse(repayment).success).toBe(true);
    expect(
      closeAccountResponseSchema.safeParse({
        account: { ...account, status: 'CLOSED' },
        settlement: {
          collateralCents: '50000',
          appliedToDebtCents: '2000',
          releasedCents: '48000',
        },
      }).success,
    ).toBe(true);
    expect(
      activitySchema.safeParse({
        id: 'a1',
        type: 'purchase',
        status: 'CAPTURED',
        amountCents: '1000',
        description: 'Corner Grocery',
        merchantName: 'Corner Grocery',
        itemCount: 0,
        items: [],
        createdAt: AT,
      }).success,
    ).toBe(true);
    expect(
      journalEntrySchema.safeParse({
        id: ID,
        kind: 'capture',
        accountId: ID,
        description: 'Purchase',
        postings: [
          { ledgerAccount: 'receivable', amountCents: '1000' },
          { ledgerAccount: 'merchant_settlement', amountCents: '-1000' },
        ],
        createdAt: AT,
      }).success,
    ).toBe(true);
    expect(amountRequestSchema.safeParse({ amountCents: 1000 }).success).toBe(false);
  });

  it('authorizations: network request, authorization, purchase', () => {
    const request = {
      cardToken: 'tok_abc',
      amountCents: '1250',
      merchant: { name: 'Corner Grocery', mcc: '5411' },
    };
    expect(networkAuthorizationRequestSchema.safeParse(request).success).toBe(true);
    expect(purchaseRequestSchema.safeParse({ ...request, extra: 1 }).success).toBe(false);
    expect(
      authorizationSchema.safeParse({
        id: ID,
        accountId: ID,
        amountCents: '1250',
        capturedCents: '0',
        status: 'DECLINED',
        declineReason: 'insufficient_funds',
        merchantName: 'Corner Grocery',
        merchantMcc: '5411',
        items: [],
        expiresAt: null,
        reversalReason: null,
        createdAt: AT,
        updatedAt: AT,
      }).success,
    ).toBe(true);
    expect(
      purchaseResultSchema.safeParse({
        authorizationId: ID,
        status: 'APPROVED',
        declineReason: null,
        availableCents: '0',
      }).success,
    ).toBe(true);
  });

  it('provider: payment and webhook', () => {
    expect(
      providerPaymentSchema.safeParse({
        id: 'pay_1',
        reference: ID,
        amountCents: '50000',
        purpose: 'deposit',
        status: 'SUCCEEDED',
        approveUrl: checkout.approveUrl,
        createdAt: AT,
        settledAt: AT,
      }).success,
    ).toBe(true);
    expect(providerWebhookSchema.safeParse({ paymentId: 'pay_1', reference: ID }).success).toBe(
      true,
    );
  });

  it('dashboard reconciliation lists at most 10 mismatched ids (both sides), uuids only', () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const of = (mismatchedAccountIds: string[]) =>
      reconciliationSchema.safeParse({
        accountsChecked: 20,
        mismatches: mismatchedAccountIds.length,
        mismatchedAccountIds,
      }).success;
    expect(RECONCILIATION_IDS_MAX).toBe(10);
    expect(of(ids(10))).toBe(true);
    expect(of(ids(11))).toBe(false);
    expect(of(['not-a-uuid'])).toBe(false);
    expect(
      reconciliationSchema.safeParse({
        accountsChecked: 0,
        mismatches: 0,
        mismatchedAccountIds: [],
      }).success,
    ).toBe(true);
  });

  it('admin: dashboard, query, audit entry', () => {
    expect(
      dashboardSchema.safeParse({
        accountsByStatus: { PENDING_COLLATERAL: 1, ACTIVE: 2, FROZEN: 0, CLOSED: 0 },
        collateralHeldCents: '0',
        creditLimitCents: '0',
        heldCents: '0',
        receivableCents: '0',
        authorizationsLast24h: { approved: 1, declined: 0 },
        ledgerTrialBalanceCents: '0',
        reconciliation: { accountsChecked: 3, mismatches: 1, mismatchedAccountIds: [ID] },
      }).success,
    ).toBe(true);
    expect(adminAccountsQuerySchema.parse({ status: 'ACTIVE', pageSize: '5' }).pageSize).toBe(5);
    expect(
      auditLogEntrySchema.safeParse({
        id: ID,
        actorType: 'admin',
        actorId: ID,
        action: 'account.freeze',
        entityType: 'account',
        entityId: ID,
        requestId: 'r-1',
        data: {},
        createdAt: AT,
      }).success,
    ).toBe(true);
  });

  it('pagination: defaults and bounds', () => {
    expect(pageQuerySchema.parse({}).pageSize).toBe(10);
    expect(pageQuerySchema.safeParse({ pageSize: '11' }).success).toBe(false);
    expect(
      pageSchema(accountSchema).safeParse({
        items: [account],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      }).success,
    ).toBe(true);
  });
});
