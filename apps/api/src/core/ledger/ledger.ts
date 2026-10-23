import type { JournalKind } from '../../generated/prisma/client';
import type { Tx } from '../database/transaction';
import type { Cents } from '../money/money';

/**
 * Chart of accounts (ADR-0002). Per card account: the collateral we hold (liability) and what
 * the customer owes (asset). Global: cash in transit with the payment provider, and what we owe
 * merchants for captured purchases. Debits are positive, credits negative.
 */
export const LEDGER = {
  cashClearing: 'cash_clearing',
  merchantSettlement: 'merchant_settlement',
  collateral: (accountId: string) => `collateral:${accountId}`,
  receivable: (accountId: string) => `receivable:${accountId}`,
} as const;

export interface PostingInput {
  ledgerAccount: string;
  amountCents: Cents;
}

export interface JournalEntryInput {
  kind: JournalKind;
  accountId: string | null;
  description: string;
  postings: PostingInput[];
}

/** The domain half of the balance rule; the deferred DB trigger is the other half. */
export function assertBalanced(postings: readonly PostingInput[]): void {
  if (postings.length < 2) throw new Error('a journal entry needs at least two postings');
  if (postings.some((posting) => posting.amountCents === 0n)) {
    throw new Error('a posting never moves zero');
  }
  const total = postings.reduce((sum, posting) => sum + posting.amountCents, 0n);
  if (total !== 0n) throw new Error(`journal entry does not balance (sum ${total})`);
}

/** Debit one ledger account and credit another by the same positive amount. */
export function transfer(input: { debit: string; credit: string; amountCents: Cents }) {
  if (input.amountCents <= 0n) throw new Error('a transfer moves a positive amount');
  return [
    { ledgerAccount: input.debit, amountCents: input.amountCents },
    { ledgerAccount: input.credit, amountCents: -input.amountCents },
  ];
}

export async function postJournalEntry(tx: Tx, entry: JournalEntryInput): Promise<string> {
  assertBalanced(entry.postings);
  const created = await tx.journalEntry.create({
    data: {
      kind: entry.kind,
      accountId: entry.accountId,
      description: entry.description,
      postings: {
        createMany: {
          data: entry.postings.map((posting) => ({
            ledgerAccount: posting.ledgerAccount,
            amountCents: posting.amountCents,
          })),
        },
      },
    },
    select: { id: true },
  });
  return created.id;
}
