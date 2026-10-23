import { describe, expect, it } from 'vitest';
import { recordChange, SYSTEM_ACTOR } from '../../audit/record-change';
import { ACTOR, fakeDb } from '../../__tests__/fake-db';
import { assertBalanced, LEDGER, postJournalEntry, transfer } from '../ledger';

describe('ledger (ADR-0002, domain half of the balance rule)', () => {
  it('names the per-account and global ledger accounts', () => {
    expect(LEDGER.collateral('a1')).toBe('collateral:a1');
    expect(LEDGER.receivable('a1')).toBe('receivable:a1');
    expect(LEDGER.cashClearing).toBe('cash_clearing');
    expect(LEDGER.merchantSettlement).toBe('merchant_settlement');
  });

  it('accepts postings that sum to zero and refuses one cent off', () => {
    expect(() =>
      assertBalanced([
        { ledgerAccount: 'a', amountCents: 150n },
        { ledgerAccount: 'b', amountCents: -100n },
        { ledgerAccount: 'c', amountCents: -50n },
      ]),
    ).not.toThrow();
    expect(() =>
      assertBalanced([
        { ledgerAccount: 'a', amountCents: 100n },
        { ledgerAccount: 'b', amountCents: -99n },
      ]),
    ).toThrow('journal entry does not balance (sum 1)');
  });

  it('refuses a single posting and a zero posting', () => {
    expect(() => assertBalanced([{ ledgerAccount: 'a', amountCents: 0n }])).toThrow('at least two');
    expect(() =>
      assertBalanced([
        { ledgerAccount: 'a', amountCents: 0n },
        { ledgerAccount: 'b', amountCents: 0n },
      ]),
    ).toThrow('never moves zero');
  });

  it('builds a two-legged transfer of a positive amount only', () => {
    expect(transfer({ debit: 'd', credit: 'c', amountCents: 1n })).toEqual([
      { ledgerAccount: 'd', amountCents: 1n },
      { ledgerAccount: 'c', amountCents: -1n },
    ]);
    expect(() => transfer({ debit: 'd', credit: 'c', amountCents: 0n })).toThrow('positive');
  });

  it('writes the entry with its postings and refuses an unbalanced one before touching the DB', async () => {
    const db = fakeDb();
    db.journalEntry.create.mockResolvedValue({ id: 'e1' });
    const postings = transfer({ debit: 'd', credit: 'c', amountCents: 500n });
    await expect(
      postJournalEntry(db as never, {
        kind: 'repayment',
        accountId: 'a1',
        description: 'x',
        postings,
      }),
    ).resolves.toBe('e1');
    expect(db.journalEntry.create).toHaveBeenCalledWith({
      data: {
        kind: 'repayment',
        accountId: 'a1',
        description: 'x',
        postings: { createMany: { data: postings } },
      },
      select: { id: true },
    });
    await expect(
      postJournalEntry(db as never, {
        kind: 'repayment',
        accountId: null,
        description: 'x',
        postings: [
          { ledgerAccount: 'd', amountCents: 5n },
          { ledgerAccount: 'c', amountCents: -4n },
        ],
      }),
    ).rejects.toThrow('does not balance');
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1);
  });
});

describe('recordChange (R-08e, P2)', () => {
  it('writes the audit row and the outbox event with the same facts', async () => {
    const db = fakeDb();
    const change = {
      action: 'deposit.confirmed',
      entityType: 'deposit',
      entityId: 'd1',
      data: { amountCents: '5' },
    };
    await recordChange(db as never, ACTOR, change);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorType: 'customer',
        actorId: ACTOR.id,
        action: 'deposit.confirmed',
        entityType: 'deposit',
        entityId: 'd1',
        requestId: 'req-1',
        data: { amountCents: '5' },
      },
      select: { id: true },
    });
    expect(db.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: 'deposit.confirmed',
        payload: {
          entityType: 'deposit',
          entityId: 'd1',
          requestId: 'req-1',
          data: { amountCents: '5' },
        },
      },
      select: { id: true },
    });
  });

  it('has a system actor for the worker', () => {
    expect(SYSTEM_ACTOR).toEqual({ type: 'system', id: null, requestId: null });
  });
});
