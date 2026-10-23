import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, sqlOf, type FakeDb } from '../../../core/__tests__/fake-db';
import { IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { AccountsService } from '../../accounts/accounts.service';
import { AuthorizationsService } from '../authorizations.service';
import { assertCapturable, holdExpiresAt } from '../helpers/authorization-rules';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const ADMIN = {
  type: 'admin' as const,
  id: '00000000-0000-4000-8000-0000000000ad',
  requestId: 'r-a',
};
const REQUEST = {
  key: '33333333-3333-4333-8333-333333333333',
  method: 'POST',
  path: '/v1/admin/authorizations/z1/release',
};
const hold = (fields: Record<string, unknown> = {}) => ({
  id: 'z1',
  accountId: 'a1',
  status: 'APPROVED' as const,
  amountCents: 1_000n,
  merchantName: 'Corner Grocery',
  expiresAt: new Date(NOW.getTime() + 1),
  reversalReason: null,
  ...fields,
});
const stored = (fields: Record<string, unknown> = {}) => ({
  ...hold(fields),
  capturedCents: 0n,
  declineReason: null,
  merchantMcc: '5411',
  items: [],
  createdAt: NOW,
  updatedAt: NOW,
});

describe('hold expiry rules (MO5)', () => {
  it('expires a hold HOLD_TTL_HOURS after its approval', () => {
    const approvedAt = new Date('2026-10-21T12:00:00.000Z');
    expect(holdExpiresAt(approvedAt, 168).toISOString()).toBe('2026-10-28T12:00:00.000Z');
    expect(holdExpiresAt(approvedAt, 1).toISOString()).toBe('2026-10-21T13:00:00.000Z');
  });

  it('captures one millisecond before the expiry, and refuses at the expiry (boundary pair)', () => {
    const live = { ...hold(), expiresAt: NOW };
    expect(() => assertCapturable(live, 1_000n, new Date(NOW.getTime() - 1))).not.toThrow();
    expect(() => assertCapturable(live, 1_000n, NOW)).toThrow(
      expect.objectContaining({
        code: 'authorization.hold_released',
        status: 409,
        details: { reason: 'expired' },
      }),
    );
  });

  it('says why a released hold cannot be captured; a network reversal stays not_capturable', () => {
    for (const reason of ['expired', 'admin_release'] as const) {
      expect(() =>
        assertCapturable(hold({ status: 'REVERSED', reversalReason: reason }), 1n, NOW),
      ).toThrow(
        expect.objectContaining({ code: 'authorization.hold_released', details: { reason } }),
      );
    }
    expect(() =>
      assertCapturable(hold({ status: 'REVERSED', reversalReason: 'network' }), 1n, NOW),
    ).toThrow(expect.objectContaining({ code: 'authorization.not_capturable' }));
  });
});

describe('AuthorizationsService: hold release', () => {
  let db: FakeDb;
  let service: AuthorizationsService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    db = fakeDb();
    db.idempotencyKey.create.mockResolvedValue({ id: 'k1' });
    const idempotency = new IdempotencyService(db as never);
    service = new AuthorizationsService(
      db as never,
      idempotency,
      new AccountsService(db as never, idempotency, {} as never),
      { HOLD_TTL_HOURS: 168 } as never,
    );
    db.authorization.findUnique.mockResolvedValue({ accountId: 'a1' });
    db.$queryRaw.mockResolvedValue([{ id: 'a1' }]);
    db.account.findUniqueOrThrow.mockResolvedValue({ id: 'a1' });
    db.authorization.findUniqueOrThrow.mockResolvedValue(hold());
    db.authorization.update.mockResolvedValue(
      stored({ status: 'REVERSED', reversalReason: 'admin_release' }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('an admin releases a live hold through the reversal path, audited with the admin', async () => {
    await expect(service.release(ADMIN, REQUEST, 'z1')).resolves.toMatchObject({
      status: 'REVERSED',
      reversalReason: 'admin_release',
    });
    expect(db.authorization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVERSED', reversalReason: 'admin_release' } }),
    );
    expect(db.account.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { heldCents: { decrement: 1_000n } },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'authorization.reversed',
          actorType: 'admin',
          actorId: ADMIN.id,
          data: { accountId: 'a1', releasedCents: '1000', reason: 'admin_release' },
        }),
      }),
    );
    // Idempotent per admin: the key is scoped to the admin who sent it.
    expect(db.idempotencyKey.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scope: ADMIN.id }) }),
    );
  });

  it('refuses to release a hold that is no longer live, or a decline', async () => {
    db.authorization.findUniqueOrThrow.mockResolvedValue(hold({ status: 'CAPTURED' }));
    await expect(service.release(ADMIN, REQUEST, 'z1')).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
    db.idempotencyKey.create.mockResolvedValue({ id: 'k2' });
    db.authorization.findUnique.mockResolvedValue({ accountId: null });
    await expect(service.release(ADMIN, REQUEST, 'z1')).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
    expect(db.account.update).not.toHaveBeenCalled();
  });

  it('the sweep locks the accounts of expired holds (SKIP LOCKED) and releases each as expired', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'z1' }, { id: 'z2' }]);
    db.authorization.findUniqueOrThrow
      .mockResolvedValueOnce(hold({ expiresAt: NOW }))
      // Captured by the network between the claim and this read: left alone.
      .mockResolvedValueOnce(hold({ id: 'z2', status: 'CAPTURED', expiresAt: NOW }));
    await expect(service.releaseExpiredHolds(NOW)).resolves.toBe(1);
    const claim = sqlOf(db.$queryRaw.mock.calls[0]);
    expect(claim).toContain("a.status = 'APPROVED' AND a.expires_at <= ?");
    expect(claim).toContain('FOR UPDATE OF ac SKIP LOCKED');
    expect(db.$queryRaw.mock.calls[0]).toContain(NOW);
    expect(db.authorization.update).toHaveBeenCalledTimes(1);
    expect(db.authorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'z1' },
        data: { status: 'REVERSED', reversalReason: 'expired' },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorType: 'system', action: 'authorization.reversed' }),
      }),
    );
  });

  it('the sweep leaves a hold whose expiry is still ahead (one millisecond)', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'z1' }]);
    db.authorization.findUniqueOrThrow.mockResolvedValue(
      hold({ expiresAt: new Date(NOW.getTime() + 1) }),
    );
    await expect(service.releaseExpiredHolds(NOW)).resolves.toBe(0);
    expect(db.authorization.update).not.toHaveBeenCalled();
  });

  it('refuses to capture a hold the sweep released (catalog code)', async () => {
    db.authorization.findUniqueOrThrow.mockResolvedValue(
      hold({ status: 'REVERSED', reversalReason: 'expired' }),
    );
    await expect(
      service.capture(
        { type: 'network', id: null, requestId: null },
        { ...REQUEST, path: '/v1/network/authorizations/z1/capture' },
        { authorizationId: 'z1', amountCents: '1000' },
      ),
    ).rejects.toMatchObject({
      code: 'authorization.hold_released',
      details: { reason: 'expired' },
    });
    expect(db.journalEntry.create).not.toHaveBeenCalled();
  });
});
