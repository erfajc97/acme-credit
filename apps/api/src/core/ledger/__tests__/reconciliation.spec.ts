import { describe, expect, it } from 'vitest';
import { mismatchOf, summarizeReconciliation, type AccountBalances } from '../reconciliation';

const A = '01a15ff8-f683-77d8-b519-b642a28494f1';

/** A reconciled account: collateral is a liability (credits are negative), the debt an asset. */
function balances(overrides: Partial<AccountBalances> = {}): AccountBalances {
  return {
    accountId: A,
    collateralCents: 20_000n,
    ledgerCollateralCents: -20_000n,
    postedDebtCents: 1_250n,
    ledgerReceivableCents: 1_250n,
    ...overrides,
  };
}

describe('mismatchOf (cached balances vs the journal, ADR-0002)', () => {
  it('accepts cached collateral = −Σ collateral postings and debt = Σ receivable postings', () => {
    expect(mismatchOf(balances())).toBeNull();
    expect(
      mismatchOf(
        balances({
          collateralCents: 0n,
          ledgerCollateralCents: 0n,
          postedDebtCents: 0n,
          ledgerReceivableCents: 0n,
        }),
      ),
    ).toBeNull();
  });

  it('flags a cached collateral one cent off either way, or with the sign not flipped', () => {
    for (const collateralCents of [20_001n, 19_999n]) {
      expect(mismatchOf(balances({ collateralCents }))?.fields).toEqual(['collateral']);
    }
    // Comparing without the sign flip would pass a ledger that says the opposite.
    expect(mismatchOf(balances({ ledgerCollateralCents: 20_000n }))?.fields).toEqual([
      'collateral',
    ]);
  });

  it('flags a cached debt one cent off either way, and both fields at once', () => {
    for (const postedDebtCents of [1_251n, 1_249n]) {
      expect(mismatchOf(balances({ postedDebtCents }))?.fields).toEqual(['receivable']);
    }
    expect(mismatchOf(balances({ collateralCents: 1n, postedDebtCents: 2n }))?.fields).toEqual([
      'collateral',
      'receivable',
    ]);
  });

  it('fingerprints the exact disagreement: the same drift is one fact, a new drift another', () => {
    const drift = mismatchOf(balances({ collateralCents: 1n }));
    expect(drift?.accountId).toBe(A);
    expect(mismatchOf(balances({ collateralCents: 1n }))?.fingerprint).toBe(drift?.fingerprint);
    expect(mismatchOf(balances({ collateralCents: 2n }))?.fingerprint).not.toBe(drift?.fingerprint);
    // Each input flipped alone, on top of the same drift, is a different fact (FT5).
    const flips: Partial<AccountBalances>[] = [
      { accountId: '01a15ff8-f683-77d8-b519-b642a28494f2' },
      { ledgerCollateralCents: -19_999n },
      { postedDebtCents: 1_251n },
      { ledgerReceivableCents: 1_251n },
    ];
    for (const flip of flips) {
      const other = mismatchOf(balances({ collateralCents: 1n, ...flip }));
      expect(other?.fingerprint, JSON.stringify(Object.keys(flip))).not.toBe(drift?.fingerprint);
    }
    // The fingerprint is a hash: no amount of an identifiable account reaches a log (OB3).
    expect(drift?.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('summarizeReconciliation (the dashboard figure)', () => {
  it('counts every account checked and every mismatch, listing at most 10 ids', () => {
    const ids = Array.from(
      { length: 12 },
      (_, n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    );
    const rows = [
      balances(),
      ...ids.map((accountId) => balances({ accountId, postedDebtCents: 0n })),
    ];
    expect(summarizeReconciliation(rows)).toEqual({
      accountsChecked: 13,
      mismatches: 12,
      mismatchedAccountIds: ids.slice(0, 10),
    });
    expect(summarizeReconciliation(rows.slice(0, 11)).mismatchedAccountIds).toHaveLength(10);
    expect(summarizeReconciliation(rows.slice(0, 10)).mismatchedAccountIds).toHaveLength(9);
  });

  it('an empty or clean book has no mismatches', () => {
    expect(summarizeReconciliation([])).toEqual({
      accountsChecked: 0,
      mismatches: 0,
      mismatchedAccountIds: [],
    });
    expect(summarizeReconciliation([balances()])).toEqual({
      accountsChecked: 1,
      mismatches: 0,
      mismatchedAccountIds: [],
    });
  });
});
