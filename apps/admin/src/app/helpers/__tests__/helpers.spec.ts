import {
  ACCOUNT_STATUSES,
  AUTHORIZATION_STATUSES,
  DECLINE_REASONS,
  ERROR_CODES,
} from '@acme/contracts';
import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, ADMIN_ID, auditEntryFixture, journalEntryFixture } from '@/test/fixtures';
import { toAuditRow } from '../audit';
import { shortId, toJournalEntryRow, trialBalanceView } from '../journal';
import { formatAmount, formatCount, percentOf } from '../money';
import { ACCOUNT_STATUS, ACTOR_TYPE, AUTHORIZATION_STATUS, DECLINE_REASON } from '../statusLabels';
import { translateError } from '../translateError';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

/** A key that resolves to itself is missing (the translator echoes unknown keys). */
const hasCopy = (key: string) => t(key) !== key;

describe('journal entries', () => {
  it('splits postings into debit and credit columns, names known ledger accounts and keeps the code', () => {
    const row = toJournalEntryRow(journalEntryFixture());
    expect(row.kindKey).toBe('journal.kind.purchase_capture');
    expect(row.createdAt).toBe('Oct 21, 2026, 12:30 PM');
    expect(row.postings).toEqual([
      {
        key: `0:receivable:${ACCOUNT_ID}`,
        nameKey: 'journal.ledgerAccount.receivable',
        ledgerAccount: `receivable:${ACCOUNT_ID}`,
        debit: '$12.50',
        credit: null,
      },
      {
        key: '1:merchant_settlement',
        nameKey: 'journal.ledgerAccount.merchant_settlement',
        ledgerAccount: 'merchant_settlement',
        debit: null,
        credit: '$12.50',
      },
    ]);
    expect(row.isBalanced).toBe(true);
    expect(row.total).toBe('$12.50');
  });

  it('flags an entry whose debits and credits differ by one cent, and shows unknown kinds by code', () => {
    const row = toJournalEntryRow(
      journalEntryFixture({
        kind: 'fx_revaluation',
        postings: [
          { ledgerAccount: 'cash_clearing', amountCents: '1001' },
          { ledgerAccount: 'suspense', amountCents: '-1000' },
        ],
      }),
    );
    expect(row.isBalanced).toBe(false);
    expect(row.kindKey).toBeNull();
    expect(row.postings[1]?.nameKey).toBeNull();
    expect(row.total).toBe('$10.01');
  });

  it('every known kind and ledger account has copy', () => {
    for (const kind of [
      'collateral_deposit',
      'purchase_capture',
      'repayment',
      'collateral_applied',
      'collateral_released',
    ]) {
      const key = toJournalEntryRow(journalEntryFixture({ kind })).kindKey;
      expect(key && hasCopy(key)).toBe(true);
    }
    for (const account of [
      'cash_clearing',
      'merchant_settlement',
      `collateral:${ACCOUNT_ID}`,
      `receivable:${ACCOUNT_ID}`,
    ]) {
      const row = toJournalEntryRow(
        journalEntryFixture({ postings: [{ ledgerAccount: account, amountCents: '1' }] }),
      );
      expect(hasCopy(row.postings[0]?.nameKey ?? '')).toBe(true);
    }
  });
});

describe('trialBalanceView (the money safety signal)', () => {
  it('is balanced only for exactly zero', () => {
    expect(trialBalanceView('0')).toEqual({ isBalanced: true, amount: '$0.00' });
    expect(trialBalanceView('1')).toEqual({ isBalanced: false, amount: '$0.01' });
    expect(trialBalanceView('-1')).toEqual({ isBalanced: false, amount: '-$0.01' });
  });

  it('a value that is not integer cents is an alert, shown as received', () => {
    expect(trialBalanceView('0.00')).toEqual({ isBalanced: false, amount: '0.00' });
    expect(trialBalanceView('')).toEqual({ isBalanced: false, amount: '' });
  });
});

describe('audit rows', () => {
  it('words the actor, links accounts and keeps the request id', () => {
    const row = toAuditRow(auditEntryFixture());
    expect(row).toMatchObject({
      actorKey: 'actor.admin',
      actorId: ADMIN_ID,
      action: 'account.frozen',
      entityHref: `/en/accounts/view?id=${ACCOUNT_ID}`,
      requestId: 'req-7f3a',
      time: 'Oct 21, 2026, 1:00 PM',
    });
  });

  it('other entities are not linked', () => {
    expect(
      toAuditRow(auditEntryFixture({ entityType: 'deposit', actorType: 'system', actorId: null }))
        .entityHref,
    ).toBeNull();
  });
});

describe('status words (never color alone)', () => {
  it('every account status, authorization status, decline reason and actor has copy', () => {
    for (const status of ACCOUNT_STATUSES)
      expect(hasCopy(ACCOUNT_STATUS[status].labelKey)).toBe(true);
    for (const status of AUTHORIZATION_STATUSES)
      expect(hasCopy(AUTHORIZATION_STATUS[status].labelKey)).toBe(true);
    for (const reason of DECLINE_REASONS) expect(hasCopy(DECLINE_REASON[reason])).toBe(true);
    for (const key of Object.values(ACTOR_TYPE)) expect(hasCopy(key)).toBe(true);
  });

  it('every API error code has admin copy (W6)', () => {
    for (const code of ERROR_CODES) expect(hasCopy(translateError(code))).toBe(true);
  });
});

describe('money and counts', () => {
  it('formats cents exactly and counts with separators', () => {
    expect(formatAmount('61250000')).toBe('$612,500.00');
    expect(formatCount(1204)).toBe('1,204');
    expect(shortId(ACCOUNT_ID)).toBe('5f3e2d1c');
  });

  it('percentOf clamps and never divides by zero', () => {
    expect(percentOf('4000', '50000')).toBe(8);
    expect(percentOf('1', '0')).toBe(0);
    expect(percentOf('60000', '50000')).toBe(100);
    expect(percentOf('-5', '50000')).toBe(0);
  });
});
