import { authorizationDetailSchema } from '@acme/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeDb, type FakeDb } from '../../../core/__tests__/fake-db';
import { IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { AccountsService } from '../../accounts/accounts.service';
import { AuthorizationsService } from '../authorizations.service';

const CUSTOMER = 'c0000000-0000-4000-8000-0000000000c1';
const ACCOUNT = 'a0000000-0000-4000-8000-0000000000a1';
const AUTHORIZATION = 'b0000000-0000-4000-8000-0000000000b1';
const CREATED = new Date('2026-10-21T12:00:00.000Z');
const CAPTURED = new Date('2026-10-21T12:07:00.000Z');
const UPDATED = new Date('2026-10-21T12:07:00.500Z');
const EXPIRES = new Date('2026-10-28T12:00:00.000Z');

/** A stored authorization with a unique value per field (FT5). */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: AUTHORIZATION,
    accountId: ACCOUNT,
    amountCents: 1_050n,
    capturedCents: 0n,
    status: 'APPROVED',
    declineReason: null,
    merchantName: 'Taquería El Sol',
    merchantMcc: '5812',
    items: [
      { sku: 'TAQ-PASTOR', name: 'Tacos al pastor', quantity: 3, unitCents: '250' },
      { sku: 'AGUA-1', name: 'Agua fresca', quantity: 1, unitCents: '300' },
    ],
    expiresAt: EXPIRES,
    reversalReason: null,
    createdAt: CREATED,
    updatedAt: UPDATED,
    ...overrides,
  };
}

describe('AuthorizationsService.getForCustomer (order detail)', () => {
  let db: FakeDb;
  let service: AuthorizationsService;

  beforeEach(() => {
    db = fakeDb();
    db.auditLog.findMany.mockResolvedValue([]);
    const idempotency = new IdempotencyService(db as never);
    service = new AuthorizationsService(
      db as never,
      idempotency,
      new AccountsService(db as never, idempotency, {} as never),
      { HOLD_TTL_HOURS: 168 } as never,
    );
  });

  it('finds the purchase only through the caller’s own account (ownership in the where)', async () => {
    db.authorization.findFirst.mockResolvedValue(null);
    await expect(service.getForCustomer(CUSTOMER, ACCOUNT, AUTHORIZATION)).rejects.toMatchObject({
      code: 'common.not_found',
    });
    expect(db.authorization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: AUTHORIZATION, accountId: ACCOUNT, account: { customerId: CUSTOMER } },
      }),
    );
  });

  it('answers the contract shape: totals, priced lines and a captured timeline', async () => {
    db.authorization.findFirst.mockResolvedValue(
      row({ status: 'CAPTURED', capturedCents: 1_050n }),
    );
    db.auditLog.findMany.mockResolvedValue([
      { action: 'authorization.captured', createdAt: CAPTURED },
    ]);
    const detail = await service.getForCustomer(CUSTOMER, ACCOUNT, AUTHORIZATION);
    expect(authorizationDetailSchema.parse(detail)).toEqual(detail);
    expect(detail).toEqual({
      id: AUTHORIZATION,
      accountId: ACCOUNT,
      status: 'CAPTURED',
      declineReason: null,
      merchantName: 'Taquería El Sol',
      merchantMcc: '5812',
      amountCents: '1050',
      capturedCents: '1050',
      itemCount: 4,
      items: [
        {
          sku: 'TAQ-PASTOR',
          name: 'Tacos al pastor',
          quantity: 3,
          unitPriceCents: '250',
          lineTotalCents: '750',
        },
        {
          sku: 'AGUA-1',
          name: 'Agua fresca',
          quantity: 1,
          unitPriceCents: '300',
          lineTotalCents: '300',
        },
      ],
      timeline: {
        createdAt: CREATED.toISOString(),
        approvedAt: CREATED.toISOString(),
        declinedAt: null,
        capturedAt: CAPTURED.toISOString(),
        reversedAt: null,
      },
      expiresAt: EXPIRES.toISOString(),
      reversalReason: null,
      createdAt: CREATED.toISOString(),
      updatedAt: UPDATED.toISOString(),
    });
    // The steps come from this purchase's own audit trail, nothing else.
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: 'authorization',
          entityId: AUTHORIZATION,
          action: { in: ['authorization.captured', 'authorization.reversed'] },
        },
        select: { action: true, createdAt: true },
      }),
    );
  });

  it('a decline is decided at creation: declinedAt is set, approvedAt is not', async () => {
    db.authorization.findFirst.mockResolvedValue(
      row({ status: 'DECLINED', declineReason: 'insufficient_funds', items: [] }),
    );
    const detail = await service.getForCustomer(CUSTOMER, ACCOUNT, AUTHORIZATION);
    expect(detail.timeline).toEqual({
      createdAt: CREATED.toISOString(),
      approvedAt: null,
      declinedAt: CREATED.toISOString(),
      capturedAt: null,
      reversedAt: null,
    });
    expect(detail).toMatchObject({ declineReason: 'insufficient_funds', itemCount: 0, items: [] });
  });

  it('a reversal (the network voiding the hold) is stamped from its audit row', async () => {
    const reversed = new Date('2026-10-21T13:30:00.000Z');
    db.authorization.findFirst.mockResolvedValue(
      row({ status: 'REVERSED', reversalReason: 'expired' }),
    );
    db.auditLog.findMany.mockResolvedValue([
      { action: 'authorization.reversed', createdAt: reversed },
    ]);
    const detail = await service.getForCustomer(CUSTOMER, ACCOUNT, AUTHORIZATION);
    expect(detail.timeline).toMatchObject({
      approvedAt: CREATED.toISOString(),
      capturedAt: null,
      reversedAt: reversed.toISOString(),
    });
    // The wallet can say why the hold went away: it expired uncaptured.
    expect(detail.reversalReason).toBe('expired');
  });
});

describe('AuthorizationsService.listForCustomer', () => {
  it('refuses a foreign account with 404 even though both reads run together', async () => {
    const db = fakeDb();
    db.account.findFirst.mockResolvedValue(null);
    db.authorization.findMany.mockResolvedValue([]);
    const idempotency = new IdempotencyService(db as never);
    const service = new AuthorizationsService(
      db as never,
      idempotency,
      new AccountsService(db as never, idempotency, {} as never),
      { HOLD_TTL_HOURS: 168 } as never,
    );
    await expect(
      service.listForCustomer(CUSTOMER, ACCOUNT, { page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
      code: 'common.not_found',
    });
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: ACCOUNT, customerId: CUSTOMER },
      select: { id: true },
    });
  });
});
