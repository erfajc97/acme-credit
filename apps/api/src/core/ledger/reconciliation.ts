import { RECONCILIATION_IDS_MAX, type Reconciliation } from '@acme/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

/** One account's cached balances next to what its journal postings add up to. */
export interface AccountBalances {
  accountId: string;
  collateralCents: bigint;
  /** Σ postings of `collateral:<id>`: a liability, so credits make it negative. */
  ledgerCollateralCents: bigint;
  postedDebtCents: bigint;
  /** Σ postings of `receivable:<id>`: an asset, so debits make it positive. */
  ledgerReceivableCents: bigint;
}

export type ReconciledField = 'collateral' | 'receivable';

export interface ReconciliationMismatch {
  accountId: string;
  fields: ReconciledField[];
  /** Hash of the exact disagreement: the same drift is reported once, never its amounts. */
  fingerprint: string;
}

/** The rule (ADR-0002): collateral = −Σ collateral postings, posted debt = Σ receivable postings. */
export function mismatchOf(row: AccountBalances): ReconciliationMismatch | null {
  const fields: ReconciledField[] = [];
  if (row.collateralCents !== -row.ledgerCollateralCents) fields.push('collateral');
  if (row.postedDebtCents !== row.ledgerReceivableCents) fields.push('receivable');
  if (fields.length === 0) return null;
  const fact = [
    row.accountId,
    row.collateralCents,
    row.ledgerCollateralCents,
    row.postedDebtCents,
    row.ledgerReceivableCents,
  ].join('|');
  return {
    accountId: row.accountId,
    fields,
    fingerprint: createHash('sha256').update(fact).digest('hex').slice(0, 16),
  };
}

export function mismatchesOf(rows: readonly AccountBalances[]): ReconciliationMismatch[] {
  return rows.flatMap((row) => mismatchOf(row) ?? []);
}

/** The dashboard figure: every account checked, every mismatch counted, a few ids listed. */
export function summarizeReconciliation(rows: readonly AccountBalances[]): Reconciliation {
  const mismatches = mismatchesOf(rows);
  return {
    accountsChecked: rows.length,
    mismatches: mismatches.length,
    mismatchedAccountIds: mismatches
      .slice(0, RECONCILIATION_IDS_MAX)
      .map((mismatch) => mismatch.accountId),
  };
}

interface BalancesRow {
  account_id: string;
  collateral_cents: bigint;
  ledger_collateral_cents: bigint;
  posted_debt_cents: bigint;
  ledger_receivable_cents: bigint;
}

/**
 * Reads every account's cached balances and its two ledger sums in ONE statement: the postings
 * of per-account ledger accounts are summed once (index on `ledger_account`), then joined by
 * name. Read-only and outside any transaction; the comparison itself is `mismatchOf`.
 */
@Injectable()
export class LedgerReconciliation {
  constructor(private readonly prisma: PrismaService) {}

  async balances(): Promise<AccountBalances[]> {
    const rows = await this.prisma.$queryRaw<BalancesRow[]>`
      WITH ledger AS (
        SELECT ledger_account, sum(amount_cents)::bigint AS balance
          FROM postings
         WHERE ledger_account LIKE 'collateral:%' OR ledger_account LIKE 'receivable:%'
         GROUP BY ledger_account
      )
      SELECT a.id::text AS account_id, a.collateral_cents, a.posted_debt_cents,
             COALESCE(c.balance, 0)::bigint AS ledger_collateral_cents,
             COALESCE(r.balance, 0)::bigint AS ledger_receivable_cents
        FROM accounts a
        LEFT JOIN ledger c ON c.ledger_account = 'collateral:' || a.id::text
        LEFT JOIN ledger r ON r.ledger_account = 'receivable:' || a.id::text
       ORDER BY a.id`;
    return rows.map((row) => ({
      accountId: row.account_id,
      collateralCents: row.collateral_cents,
      ledgerCollateralCents: row.ledger_collateral_cents,
      postedDebtCents: row.posted_debt_cents,
      ledgerReceivableCents: row.ledger_receivable_cents,
    }));
  }
}
