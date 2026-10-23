import { vi, type Mock } from 'vitest';

const MODELS = [
  'account',
  'collateralDeposit',
  'repayment',
  'payout',
  'authorization',
  'journalEntry',
  'posting',
  'idempotencyKey',
  'auditLog',
  'outboxEvent',
  'user',
  'refreshToken',
] as const;

const METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'update',
  'updateMany',
  'upsert',
  'deleteMany',
  'aggregate',
  'count',
  'groupBy',
] as const;

type ModelStub = Record<(typeof METHODS)[number], Mock>;

export type FakeDb = Record<(typeof MODELS)[number], ModelStub> & {
  $queryRaw: Mock;
  $executeRaw: Mock;
  $transaction: Mock;
};

/**
 * Hand-written Prisma stub for service specs (AN13): every model method is a `vi.fn()` that
 * returns undefined until a test says otherwise, and `$transaction` runs the callback with the
 * same stub as `tx`. It proves what a service ASKS for; the integration suite proves what the
 * database DOES (FT6).
 */
export function fakeDb(): FakeDb {
  const db = {
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 0),
  } as unknown as FakeDb;
  for (const model of MODELS) {
    db[model] = Object.fromEntries(METHODS.map((method) => [method, vi.fn()])) as ModelStub;
  }
  // The idempotency record is written conditionally (its attempt still owns it): owned by default.
  db.idempotencyKey.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction = vi.fn(async (work: (tx: FakeDb) => Promise<unknown>) => work(db));
  return db;
}

/** The SQL text of a tagged-template call recorded by `$queryRaw` / `$executeRaw`. */
export function sqlOf(call: unknown[] | undefined): string {
  const strings = call?.[0];
  if (strings && typeof strings === 'object' && 'join' in strings) {
    return (strings as string[]).join('?').replace(/\s+/g, ' ').trim();
  }
  return String(strings);
}

export const ACTOR = {
  type: 'customer',
  id: '00000000-0000-4000-8000-0000000000c1',
  requestId: 'req-1',
} as const;
