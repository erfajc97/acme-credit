import { describe, expect, it } from 'vitest';
import {
  activitySchema,
  authorizationDetailSchema,
  itemCountOf,
  PAGE_NUMBER_MAX,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  pageQuerySchema,
  pageSchema,
  purchaseLineSchema,
  toPurchaseLines,
  totalPagesOf,
} from '../index';

const ID = '01a15ff8-f683-77d8-b519-b642a28494ff';
const AT = '2026-10-21T12:00:00.000Z';

describe('pageQuerySchema (numbered pages, at most 10 rows each, owner decision)', () => {
  it('no params is page 1 of 10 rows', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
    expect(PAGE_SIZE_DEFAULT).toBe(10);
    expect(PAGE_SIZE_MAX).toBe(10);
  });

  it('coerces query strings: pageSize 1 and 10 pass, 0 and 11 fail (both sides)', () => {
    expect(pageQuerySchema.parse({ pageSize: '1' }).pageSize).toBe(1);
    expect(pageQuerySchema.parse({ pageSize: '10' }).pageSize).toBe(10);
    expect(pageQuerySchema.safeParse({ pageSize: '0' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ pageSize: '11' }).success).toBe(false);
  });

  it('page 1 passes and 0 fails; the ceiling bounds the OFFSET a client can ask for', () => {
    expect(pageQuerySchema.parse({ page: '1' }).page).toBe(1);
    expect(pageQuerySchema.parse({ page: '37' }).page).toBe(37);
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(pageQuerySchema.parse({ page: String(PAGE_NUMBER_MAX) }).page).toBe(PAGE_NUMBER_MAX);
    expect(pageQuerySchema.safeParse({ page: String(PAGE_NUMBER_MAX + 1) }).success).toBe(false);
  });

  it('typed clients may pass numbers; strict digits only from the query string', () => {
    expect(pageQuerySchema.parse({ page: 3, pageSize: 5 })).toEqual({ page: 3, pageSize: 5 });
    for (const bad of ['', ' 2', '2.5', '1e1', '-1', '+2', 'two', '0x2', '2 ']) {
      expect(pageQuerySchema.safeParse({ page: bad }).success, `page=${bad}`).toBe(false);
      expect(pageQuerySchema.safeParse({ pageSize: bad }).success, `pageSize=${bad}`).toBe(false);
    }
    expect(pageQuerySchema.safeParse({ page: 2.5 }).success).toBe(false);
  });

  it('rejects unknown query keys, including the retired cursor contract (strict)', () => {
    expect(pageQuerySchema.safeParse({ cursor: 'abc' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: '5' }).success).toBe(false);
  });

  it('pages are { items, page, pageSize, total, totalPages } and nothing else', () => {
    const page = pageSchema(purchaseLineSchema);
    const empty = { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 };
    expect(page.parse(empty)).toEqual(empty);
    expect(page.safeParse({ ...empty, nextCursor: null }).success).toBe(false);
    const { totalPages: _dropped, ...withoutTotalPages } = empty;
    expect(page.safeParse(withoutTotalPages).success).toBe(false);
  });
});

describe('totalPagesOf (one formula for the API and the clients)', () => {
  it('is at least 1, so an empty list still has a page 1', () => {
    expect(totalPagesOf({ total: 0, pageSize: 10 })).toBe(1);
  });

  it('rounds up: 10 rows is 1 page, 11 rows is 2, 20 is 2, 21 is 3', () => {
    expect(totalPagesOf({ total: 1, pageSize: 10 })).toBe(1);
    expect(totalPagesOf({ total: 10, pageSize: 10 })).toBe(1);
    expect(totalPagesOf({ total: 11, pageSize: 10 })).toBe(2);
    expect(totalPagesOf({ total: 20, pageSize: 10 })).toBe(2);
    expect(totalPagesOf({ total: 21, pageSize: 10 })).toBe(3);
    expect(totalPagesOf({ total: 7, pageSize: 3 })).toBe(3);
  });
});

describe('purchase lines (structured order data for the clients)', () => {
  const lines = [
    { sku: 'APL-1', name: 'Apples', quantity: 3, unitCents: '1999' },
    { sku: 'BRD-1', name: 'Bread', quantity: 1, unitCents: '450' },
  ];

  it('prices every line from its unit price and quantity, as cents strings', () => {
    expect(toPurchaseLines(lines)).toEqual([
      { sku: 'APL-1', name: 'Apples', quantity: 3, unitPriceCents: '1999', lineTotalCents: '5997' },
      { sku: 'BRD-1', name: 'Bread', quantity: 1, unitPriceCents: '450', lineTotalCents: '450' },
    ]);
    expect(toPurchaseLines([])).toEqual([]);
  });

  it('counts units, not lines; a plain card purchase has 0', () => {
    expect(itemCountOf(lines)).toBe(4);
    expect(itemCountOf([])).toBe(0);
  });

  it('activity carries merchant, item count and lines next to the legacy description', () => {
    const purchase = {
      id: ID,
      type: 'purchase',
      status: 'APPROVED',
      amountCents: '6447',
      description: 'Corner Grocery · 4 items',
      merchantName: 'Corner Grocery',
      itemCount: 4,
      items: toPurchaseLines(lines),
      createdAt: AT,
    };
    expect(activitySchema.parse(purchase)).toEqual(purchase);
    expect(
      activitySchema.safeParse({
        ...purchase,
        type: 'deposit',
        merchantName: null,
        itemCount: 0,
        items: [],
      }).success,
    ).toBe(true);
    const { itemCount: _dropped, ...withoutCount } = purchase;
    expect(activitySchema.safeParse(withoutCount).success).toBe(false);
  });

  it('the order detail has the totals, lines and status timeline', () => {
    const detail = {
      id: ID,
      accountId: ID,
      status: 'CAPTURED',
      declineReason: null,
      merchantName: 'Corner Grocery',
      merchantMcc: '5411',
      amountCents: '6447',
      capturedCents: '6447',
      itemCount: 4,
      items: toPurchaseLines(lines),
      timeline: {
        createdAt: AT,
        approvedAt: AT,
        declinedAt: null,
        capturedAt: '2026-10-21T12:05:00.000Z',
        reversedAt: null,
      },
      expiresAt: '2026-10-28T12:00:00.000Z',
      reversalReason: null,
      createdAt: AT,
      updatedAt: '2026-10-21T12:05:00.000Z',
    };
    expect(authorizationDetailSchema.parse(detail)).toEqual(detail);
    expect(
      authorizationDetailSchema.safeParse({ ...detail, timeline: { createdAt: AT } }).success,
    ).toBe(false);
  });
});
