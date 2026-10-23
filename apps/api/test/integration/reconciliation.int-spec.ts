import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LedgerReconciliation } from '../../src/core/ledger/reconciliation';
import { LedgerReconciliationJob } from '../../src/modules/admin/jobs/ledger-reconciliation.job';
import {
  activeAccount,
  createUser,
  purchase,
  signedPost,
  startHarness,
  type Harness,
  type TestUser,
} from './support/harness';

/**
 * R-08c, ADR-0002: every account's cached balances agree with its journal. Real flows (deposit,
 * purchase, capture) keep them equal; a cached balance changed behind the journal's back is
 * reported by the dashboard and by the worker job, against the real database (FT6).
 */

let h: Harness;
let admin: TestUser;
let drifted: { id: string; postedDebtCents: bigint } | undefined;

async function reconciliation() {
  const res = await h.http.get('/v1/admin/dashboard').set(admin.auth);
  expect(res.status).toBe(200);
  return res.body.reconciliation as {
    accountsChecked: number;
    mismatches: number;
    mismatchedAccountIds: string[];
  };
}

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, 'admin');
});

afterAll(async () => {
  // Put the cached balance back so later files see a clean book.
  if (drifted) {
    await h.db.$executeRaw`
      UPDATE accounts SET posted_debt_cents = ${drifted.postedDebtCents}
       WHERE id = ${drifted.id}::uuid`;
  }
  await h.close();
});

describe('per-account reconciliation (GET /v1/admin/dashboard)', () => {
  it('reports 0 mismatches over every account after the real money flows', async () => {
    const customer = await createUser(h);
    const account = await activeAccount(h, customer, '20000');
    const auth = await purchase(h, account.card?.token ?? '', '1150');
    expect(auth.body).toMatchObject({ status: 'APPROVED' });
    const captured = await signedPost(
      h,
      'network',
      `/v1/network/authorizations/${auth.body.id as string}/capture`,
      { amountCents: '1150' },
      { 'Idempotency-Key': randomUUID() },
    );
    expect(captured.status).toBe(201);

    const report = await reconciliation();
    expect(Object.keys(report).sort()).toEqual([
      'accountsChecked',
      'mismatchedAccountIds',
      'mismatches',
    ]);
    expect(report).toEqual({
      accountsChecked: await h.db.account.count(),
      mismatches: 0,
      mismatchedAccountIds: [],
    });
  });

  it('names the one account whose cached debt was changed behind the journal', async () => {
    const customer = await createUser(h);
    const account = await activeAccount(h, customer, '20000');
    const auth = await purchase(h, account.card?.token ?? '', '700');
    await signedPost(
      h,
      'network',
      `/v1/network/authorizations/${auth.body.id as string}/capture`,
      { amountCents: '700' },
      { 'Idempotency-Key': randomUUID() },
    );
    const stored = await h.db.account.findUniqueOrThrow({
      where: { id: account.id },
      select: { postedDebtCents: true },
    });
    expect(stored.postedDebtCents).toBe(700n);
    drifted = { id: account.id, postedDebtCents: stored.postedDebtCents };
    await h.db.$executeRaw`
      UPDATE accounts SET posted_debt_cents = posted_debt_cents - 1 WHERE id = ${account.id}::uuid`;

    const report = await reconciliation();
    expect(report).toMatchObject({ mismatches: 1, mismatchedAccountIds: [account.id] });

    // The worker job sees the same fact and reports it once, however many ticks it lasts.
    const errors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const job = new LedgerReconciliationJob(h.app.get(LedgerReconciliation, { strict: false }));
      await expect(job.runOnce()).resolves.toBe(1);
      await expect(job.runOnce()).resolves.toBe(1);
      expect(errors).toHaveBeenCalledTimes(1);
      expect(errors.mock.calls[0]?.[0]).toMatchObject({
        event: 'ledger_reconciliation_mismatch',
        accountId: account.id,
        fields: ['receivable'],
      });
    } finally {
      errors.mockRestore();
    }
  });
});
