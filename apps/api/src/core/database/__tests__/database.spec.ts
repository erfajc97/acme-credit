import { describe, expect, it, vi } from 'vitest';
import { fakeDb, sqlOf } from '../../__tests__/fake-db';
import { lockAccount, lockAccountByCardToken } from '../account-lock';
import { isUniqueViolation, sqlStateOf } from '../db-errors';
import { MAX_TRANSACTION_ATTEMPTS, runInTransaction } from '../transaction';

/** Error shapes copied from what Prisma 7 + adapter-pg really throw (FT18). */
const statementError = (code: string) => ({
  name: 'PrismaClientKnownRequestError',
  code: 'P2010',
  meta: { driverAdapterError: { cause: { originalCode: code } } },
});
const commitError = (code: string) => ({
  name: 'DriverAdapterError',
  cause: { originalCode: code },
});

describe('sqlStateOf', () => {
  it('reads the SQLSTATE of a failed statement, a failed commit and a write conflict', () => {
    expect(sqlStateOf(statementError('55P03'))).toBe('55P03');
    expect(sqlStateOf(commitError('23514'))).toBe('23514');
    expect(sqlStateOf({ name: 'PrismaClientKnownRequestError', code: 'P2034' })).toBe('40001');
  });

  it('returns undefined for anything else', () => {
    expect(sqlStateOf(new Error('boom'))).toBeUndefined();
    expect(sqlStateOf(null)).toBeUndefined();
    expect(sqlStateOf('40001')).toBeUndefined();
    expect(sqlStateOf({ code: 'P2002' })).toBeUndefined();
  });

  it('recognises a unique violation by name and code only', () => {
    expect(isUniqueViolation({ name: 'PrismaClientKnownRequestError', code: 'P2002' })).toBe(true);
    expect(isUniqueViolation({ name: 'Error', code: 'P2002' })).toBe(false);
    expect(isUniqueViolation({ name: 'PrismaClientKnownRequestError', code: 'P2025' })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe('runInTransaction (MO3: the one retry helper)', () => {
  function runner(failures: unknown[]) {
    const db = fakeDb();
    let calls = 0;
    db.$transaction.mockImplementation(async (work: (tx: typeof db) => Promise<unknown>) => {
      const failure = failures[calls];
      calls += 1;
      if (failure) throw failure;
      return work(db);
    });
    return { db, attempts: () => calls };
  }
  const noSleep = { sleep: vi.fn(async () => undefined), random: () => 0.5 };

  it('sets the 3 s lock timeout before the work and returns its result', async () => {
    const { db } = runner([]);
    await expect(runInTransaction(db as never, async () => 'done', noSleep)).resolves.toBe('done');
    expect(sqlOf(db.$executeRaw.mock.calls[0])).toBe("SET LOCAL lock_timeout = '3s'");
  });

  it('retries a serialization failure and a deadlock, then succeeds on the last attempt', async () => {
    const { db, attempts } = runner([statementError('40001'), commitError('40P01')]);
    await expect(runInTransaction(db as never, async () => 'ok', noSleep)).resolves.toBe('ok');
    expect(attempts()).toBe(MAX_TRANSACTION_ATTEMPTS);
    expect(noSleep.sleep).toHaveBeenCalledWith(30);
  });

  it('gives up after 3 attempts with 409 operation.in_progress', async () => {
    const conflict = statementError('40001');
    const { db, attempts } = runner([conflict, conflict, conflict, conflict]);
    await expect(runInTransaction(db as never, async () => 'never', noSleep)).rejects.toMatchObject(
      {
        code: 'operation.in_progress',
      },
    );
    expect(attempts()).toBe(3);
  });

  it('answers a lock timeout or a transaction timeout at once, without retrying', async () => {
    const lock = runner([statementError('55P03')]);
    await expect(runInTransaction(lock.db as never, async () => 1, noSleep)).rejects.toMatchObject({
      code: 'operation.in_progress',
    });
    expect(lock.attempts()).toBe(1);
    const timeout = runner([{ name: 'PrismaClientKnownRequestError', code: 'P2028' }]);
    await expect(
      runInTransaction(timeout.db as never, async () => 1, noSleep),
    ).rejects.toMatchObject({
      code: 'operation.in_progress',
    });
  });

  it('rethrows any other error untouched', async () => {
    const constraint = commitError('23514');
    const { db, attempts } = runner([constraint]);
    await expect(runInTransaction(db as never, async () => 1, noSleep)).rejects.toBe(constraint);
    const plain = runner([new Error('bug')]);
    await expect(runInTransaction(plain.db as never, async () => 1, noSleep)).rejects.toThrow(
      'bug',
    );
    expect(attempts()).toBe(1);
  });
});

describe('account locks (ADR-0003)', () => {
  it('locks by id, scoped to the owner when one is given', async () => {
    const db = fakeDb();
    db.$queryRaw.mockResolvedValueOnce([{ id: 'a1' }]).mockResolvedValueOnce([]);
    await expect(lockAccount(db as never, { accountId: 'a1' })).resolves.toBe(true);
    expect(sqlOf(db.$queryRaw.mock.calls[0])).toContain('FOR UPDATE');
    await expect(lockAccount(db as never, { accountId: 'a1', ownerId: 'u2' })).resolves.toBe(false);
    expect(sqlOf(db.$queryRaw.mock.calls[1])).toContain('customer_id = ?::uuid');
    expect(db.$queryRaw.mock.calls[1]?.slice(1)).toEqual(['a1', 'u2']);
  });

  it('locks the account behind a card token, or reports none', async () => {
    const db = fakeDb();
    db.$queryRaw.mockResolvedValueOnce([{ id: 'a9' }]).mockResolvedValueOnce([]);
    await expect(lockAccountByCardToken(db as never, 'card_x')).resolves.toBe('a9');
    await expect(lockAccountByCardToken(db as never, 'card_y')).resolves.toBeNull();
  });
});
