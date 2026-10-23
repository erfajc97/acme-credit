import type { JournalEntry } from '@acme/contracts';
import { formatDateTime } from './dates';
import { formatAmount } from './money';

/** The journal kinds the core posts today; anything newer is shown by its code. */
const JOURNAL_KIND: Record<string, string> = {
  collateral_deposit: 'journal.kind.collateral_deposit',
  purchase_capture: 'journal.kind.purchase_capture',
  repayment: 'journal.kind.repayment',
  collateral_applied: 'journal.kind.collateral_applied',
  collateral_released: 'journal.kind.collateral_released',
};

/** The chart of accounts (ADR-0002): per card account `collateral:<id>` and `receivable:<id>`. */
const LEDGER_ACCOUNT: Record<string, string> = {
  cash_clearing: 'journal.ledgerAccount.cash_clearing',
  merchant_settlement: 'journal.ledgerAccount.merchant_settlement',
  collateral: 'journal.ledgerAccount.collateral',
  receivable: 'journal.ledgerAccount.receivable',
};

export interface PostingRow {
  key: string;
  /** i18n key of the ledger account's name, or null for an account this console does not know. */
  nameKey: string | null;
  /** The raw ledger account, always shown (mono) so nothing is hidden from an auditor. */
  ledgerAccount: string;
  /** Formatted debit (positive posting) or null. */
  debit: string | null;
  /** Formatted credit (negative posting, shown unsigned in its column) or null. */
  credit: string | null;
}

export interface JournalEntryRow {
  id: string;
  kindKey: string | null;
  kind: string;
  description: string;
  createdAt: string;
  accountId: string | null;
  postings: PostingRow[];
  /** Debits equal credits: the double-entry rule every entry must keep. */
  isBalanced: boolean;
  /** Total of the debit column (equals the credits when balanced). */
  total: string;
}

function toPostingRow(posting: JournalEntry['postings'][number], index: number): PostingRow {
  const cents = BigInt(posting.amountCents);
  const [prefix = ''] = posting.ledgerAccount.split(':');
  return {
    key: `${index}:${posting.ledgerAccount}`,
    nameKey: LEDGER_ACCOUNT[prefix] ?? null,
    ledgerAccount: posting.ledgerAccount,
    debit: cents > 0n ? formatAmount(cents) : null,
    credit: cents < 0n ? formatAmount(-cents) : null,
  };
}

/** One journal entry as the ledger tables show it: debit and credit columns, never a sign. */
export function toJournalEntryRow(entry: JournalEntry): JournalEntryRow {
  const amounts = entry.postings.map((posting) => BigInt(posting.amountCents));
  const debits = amounts.filter((cents) => cents > 0n).reduce((sum, cents) => sum + cents, 0n);
  const sum = amounts.reduce((total, cents) => total + cents, 0n);
  return {
    id: entry.id,
    kindKey: JOURNAL_KIND[entry.kind] ?? null,
    kind: entry.kind,
    description: entry.description,
    createdAt: formatDateTime(entry.createdAt),
    accountId: entry.accountId,
    postings: entry.postings.map(toPostingRow),
    isBalanced: sum === 0n,
    total: formatAmount(debits),
  };
}

export interface TrialBalanceView {
  /** The ledger's money safety signal: the sum of every posting is exactly zero. */
  isBalanced: boolean;
  /** The sum, formatted; a value that is not integer cents is shown as received, never hidden. */
  amount: string;
}

/** Reads the dashboard's trial balance; anything but exactly "0" is an alert. */
export function trialBalanceView(trialBalanceCents: string): TrialBalanceView {
  if (!/^-?\d{1,18}$/.test(trialBalanceCents))
    return { isBalanced: false, amount: trialBalanceCents };
  const cents = BigInt(trialBalanceCents);
  return { isBalanced: cents === 0n, amount: formatAmount(cents) };
}

/** The first block of a UUID, enough to tell rows apart at a glance (the full id is in a title). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
