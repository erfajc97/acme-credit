import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBalances } from '../../../core/ledger/reconciliation';
import { LedgerReconciliationJob } from '../jobs/ledger-reconciliation.job';

const A = '01a15ff8-f683-77d8-b519-b642a28494f1';
const B = '01a15ff8-f683-77d8-b519-b642a28494f2';

function row(accountId: string, collateralCents = 500n): AccountBalances {
  return {
    accountId,
    collateralCents,
    ledgerCollateralCents: -500n,
    postedDebtCents: 0n,
    ledgerReceivableCents: 0n,
  };
}

describe('LedgerReconciliationJob (worker, periodic)', () => {
  let balances: ReturnType<typeof vi.fn>;
  let job: LedgerReconciliationJob;
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    balances = vi.fn();
    job = new LedgerReconciliationJob({ balances } as never);
    errors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errors.mockRestore());

  it('logs nothing on a clean book', async () => {
    balances.mockResolvedValue([row(A), row(B)]);
    await expect(job.runOnce()).resolves.toBe(0);
    expect(errors).not.toHaveBeenCalled();
  });

  it('logs each drift once with ids and fields only, however many ticks it lasts', async () => {
    balances.mockResolvedValue([row(A, 499n), row(B)]);
    await expect(job.runOnce()).resolves.toBe(1);
    await expect(job.runOnce()).resolves.toBe(1);
    expect(errors).toHaveBeenCalledTimes(1);
    const [context] = errors.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(context).sort()).toEqual(['accountId', 'event', 'fields', 'fingerprint']);
    expect(context).toMatchObject({
      event: 'ledger_reconciliation_mismatch',
      accountId: A,
      fields: ['collateral'],
    });
  });

  it('a new drift on the same account is a new fact; a drift that heals and returns is too', async () => {
    balances.mockResolvedValueOnce([row(A, 499n)]);
    await job.runOnce();
    balances.mockResolvedValueOnce([row(A, 498n)]);
    await job.runOnce();
    expect(errors).toHaveBeenCalledTimes(2);
    balances.mockResolvedValueOnce([row(A)]);
    await job.runOnce();
    balances.mockResolvedValueOnce([row(A, 498n)]);
    await job.runOnce();
    expect(errors).toHaveBeenCalledTimes(3);
  });
});
