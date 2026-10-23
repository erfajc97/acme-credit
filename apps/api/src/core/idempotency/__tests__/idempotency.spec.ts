import { AppHttpException } from '@acme/nest-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTOR, fakeDb, type FakeDb } from '../../__tests__/fake-db';
import { IDEMPOTENCY_LEASE_MS, IdempotencyService, replayResponse } from '../idempotency.service';
import { canonicalJson, requestHash } from '../request-hash';
import { idempotencyScope } from '../scope';

const UNIQUE = { name: 'PrismaClientKnownRequestError', code: 'P2002' };
const CONTEXT = {
  scope: 'u1',
  key: '11111111-1111-4111-8111-111111111111',
  method: 'POST',
  path: '/v1/accounts/a1/deposits',
  body: { amountCents: '20000' },
};
const HASH = requestHash(CONTEXT);

describe('request hash (ADR-0004)', () => {
  it('ignores key order and undefined fields, but not values or the route', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[1,{"y":2,"z":1}]},"b":1}',
    );
    expect(canonicalJson(undefined)).toBe('null');
    expect(requestHash({ ...CONTEXT, body: { amountCents: '20000' } })).toBe(HASH);
    expect(requestHash({ ...CONTEXT, body: { amountCents: '20001' } })).not.toBe(HASH);
    expect(requestHash({ ...CONTEXT, path: '/v1/accounts/a2/deposits' })).not.toBe(HASH);
    expect(requestHash({ ...CONTEXT, method: 'post' })).toBe(HASH);
  });

  it('scopes keys by caller', () => {
    expect(idempotencyScope(ACTOR)).toBe(ACTOR.id);
    expect(idempotencyScope({ type: 'network', id: null, requestId: null })).toBe('network');
  });
});

describe('IdempotencyService', () => {
  const NOW = new Date('2026-10-22T12:00:00.000Z');
  const LEASE_END = new Date(NOW.getTime() + IDEMPOTENCY_LEASE_MS);
  const CLAIM = { recordId: 'k1', attempt: 1 };
  let db: FakeDb;
  let service: IdempotencyService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    db = fakeDb();
    db.idempotencyKey.updateMany.mockResolvedValue({ count: 1 });
    service = new IdempotencyService(db as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function existing(row: Record<string, unknown>) {
    db.idempotencyKey.create.mockRejectedValue(UNIQUE);
    db.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: HASH,
      status: 'PENDING',
      resourceId: null,
      responseStatus: null,
      responseBody: null,
      attempt: 1,
      lockedUntil: LEASE_END,
      ...row,
    });
  }

  it('claims a new key with the request hash and a 60 s lease', async () => {
    expect(IDEMPOTENCY_LEASE_MS).toBe(60_000);
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    await expect(service.begin(CONTEXT)).resolves.toEqual({
      kind: 'started',
      recordId: 'k1',
      attempt: 1,
      resourceId: null,
    });
    expect(db.idempotencyKey.create).toHaveBeenCalledWith({
      data: { scope: 'u1', key: CONTEXT.key, requestHash: HASH, lockedUntil: LEASE_END },
      select: { id: true },
    });
  });

  it('replays a completed key with the same payload', async () => {
    existing({ status: 'COMPLETED', responseStatus: 201, responseBody: { id: 'd1' } });
    await expect(service.begin(CONTEXT)).resolves.toEqual({
      kind: 'replay',
      status: 201,
      body: { id: 'd1' },
    });
  });

  it('refuses the same key with another payload, and a key still in flight', async () => {
    existing({ requestHash: 'f'.repeat(64), status: 'COMPLETED', responseStatus: 201 });
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.key_reused' });
    existing({ status: 'PENDING' });
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.in_progress' });
    expect(db.idempotencyKey.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a different payload even when the lease of the first attempt lapsed', async () => {
    existing({ requestHash: 'f'.repeat(64), lockedUntil: new Date(NOW.getTime() - 1) });
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.key_reused' });
    expect(db.idempotencyKey.updateMany).not.toHaveBeenCalled();
  });

  it('keeps a live lease to its owner: one millisecond before it lapses is still in progress', async () => {
    existing({ lockedUntil: new Date(NOW.getTime() + 1) });
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.in_progress' });
    expect(db.idempotencyKey.updateMany).not.toHaveBeenCalled();
  });

  it('takes over a crashed attempt once its lease lapsed, as the next attempt (atomic)', async () => {
    // The request that claimed the key died: its transaction never committed and the key stayed
    // PENDING. Without the lease it would answer in_progress forever.
    existing({ lockedUntil: NOW, attempt: 3, resourceId: 'd1' });
    await expect(service.begin(CONTEXT)).resolves.toEqual({
      kind: 'started',
      recordId: 'k1',
      attempt: 4,
      resourceId: 'd1',
    });
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'k1', status: 'PENDING', attempt: 3, lockedUntil: { lte: NOW } },
      data: { attempt: 4, lockedUntil: LEASE_END },
    });
  });

  it('lets only one of two retries take over (the conditional update decides)', async () => {
    existing({ lockedUntil: new Date(NOW.getTime() - 1) });
    db.idempotencyKey.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.in_progress' });
  });

  it('answers in_progress when the conflicting row vanished in between', async () => {
    db.idempotencyKey.create.mockRejectedValue(UNIQUE);
    db.idempotencyKey.findUnique.mockResolvedValue(null);
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.in_progress' });
  });

  it('resumes a RETRYABLE key once, with the resource the first attempt created', async () => {
    existing({ status: 'RETRYABLE', resourceId: 'd1', attempt: 2 });
    db.idempotencyKey.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await expect(service.begin(CONTEXT)).resolves.toEqual({
      kind: 'started',
      recordId: 'k1',
      attempt: 3,
      resourceId: 'd1',
    });
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'k1', status: 'RETRYABLE', attempt: 2 },
      data: { status: 'PENDING', attempt: 3, lockedUntil: LEASE_END },
    });
    await expect(service.begin(CONTEXT)).rejects.toMatchObject({ code: 'idempotency.in_progress' });
  });

  it('rethrows an insert failure that is not a duplicate', async () => {
    db.idempotencyKey.create.mockRejectedValue(new Error('db down'));
    await expect(service.begin(CONTEXT)).rejects.toThrow('db down');
  });

  it('stores a stable business error so the retry gets the same answer, while it owns the key', async () => {
    await service.fail(
      CLAIM,
      new AppHttpException('deposit.amount_out_of_range', { minCents: '20000' }),
    );
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'k1', attempt: 1, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        responseStatus: 422,
        responseBody: { code: 'deposit.amount_out_of_range', details: { minCents: '20000' } },
      },
    });
    await service.fail({ recordId: 'k2', attempt: 1 }, new AppHttpException('account.closed'));
    expect(db.idempotencyKey.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responseBody: { code: 'account.closed' } }),
      }),
    );
  });

  it('releases a key after a transient failure, or parks it RETRYABLE when a resource exists', async () => {
    db.idempotencyKey.findUnique.mockResolvedValueOnce({ resourceId: null });
    await service.fail(CLAIM, new AppHttpException('operation.in_progress'));
    expect(db.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: { id: 'k1', attempt: 1, status: 'PENDING' },
    });

    db.idempotencyKey.findUnique.mockResolvedValueOnce({ resourceId: 'd1' });
    await service.fail(
      { recordId: 'k2', attempt: 2 },
      new AppHttpException('payment.provider_unavailable'),
    );
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'k2', attempt: 2, status: 'PENDING' },
      data: { status: 'RETRYABLE' },
    });

    db.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    await service.fail({ recordId: 'k3', attempt: 1 }, new Error('bug'));
    expect(db.idempotencyKey.deleteMany).toHaveBeenLastCalledWith({
      where: { id: 'k3', attempt: 1, status: 'PENDING' },
    });
  });

  it('runs the effect and stores its response in the same transaction, as the owner', async () => {
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    await expect(service.execute(CONTEXT, 201, async () => ({ id: 'a1' }))).resolves.toEqual({
      id: 'a1',
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'k1', attempt: 1, status: 'PENDING' },
      data: { status: 'COMPLETED', responseStatus: 201, responseBody: { id: 'a1' } },
    });
  });

  it('rolls the effect back when another attempt took the key over meanwhile', async () => {
    // A slow first attempt whose lease lapsed: the retry owns the key now, so this attempt's
    // effect must not commit (its transaction throws), or the money would move twice.
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    db.idempotencyKey.updateMany.mockResolvedValue({ count: 0 });
    db.idempotencyKey.findUnique.mockResolvedValue({ resourceId: null });
    await expect(service.execute(CONTEXT, 201, async () => ({ id: 'a1' }))).rejects.toMatchObject({
      code: 'idempotency.in_progress',
    });
    await expect(service.complete(db as never, CLAIM, 201, {})).rejects.toMatchObject({
      code: 'idempotency.in_progress',
    });
  });

  it('replays without running the effect, and records a failing effect', async () => {
    existing({
      status: 'COMPLETED',
      responseStatus: 409,
      responseBody: { code: 'account.already_open' },
    });
    let ran = false;
    await expect(
      service.execute(CONTEXT, 201, async () => {
        ran = true;
        return {};
      }),
    ).rejects.toMatchObject({ code: 'account.already_open' });
    expect(ran).toBe(false);

    db.idempotencyKey.create.mockReset().mockResolvedValue({ id: 'k9' });
    await expect(
      service.execute(CONTEXT, 201, async () => {
        throw new AppHttpException('account.closed');
      }),
    ).rejects.toMatchObject({ code: 'account.closed' });
    expect(db.idempotencyKey.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 'k9', attempt: 1, status: 'PENDING' } }),
    );
  });

  it('attaches the created resource to the key it still owns', async () => {
    await service.attachResource(db as never, CLAIM, 'd1');
    expect(db.idempotencyKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'k1', attempt: 1, status: 'PENDING' },
      data: { resourceId: 'd1' },
    });
    db.idempotencyKey.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.attachResource(db as never, CLAIM, 'd1')).rejects.toMatchObject({
      code: 'idempotency.in_progress',
    });
  });
});

describe('replayResponse', () => {
  it('returns a stored success body and rethrows a stored error by code', () => {
    expect(replayResponse({ status: 200, body: { ok: true } })).toEqual({ ok: true });
    expect(() => replayResponse({ status: 409, body: { code: 'account.closed' } })).toThrow(
      AppHttpException,
    );
    expect(replayResponse({ status: 422, body: ['not an error body'] })).toEqual([
      'not an error body',
    ]);
  });
});
