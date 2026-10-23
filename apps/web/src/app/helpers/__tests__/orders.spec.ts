import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, authorizationDetailFixture, authorizationFixture } from '@/test/fixtures';
import { plain } from '@/test/text';
import { detailFromListItem, toOrderDetail, toOrderRow } from '../orders';

describe('toOrderRow', () => {
  afterEach(() => setActiveLocale('es-MX'));

  it('summarizes a store order with its item count and localized lines', () => {
    const row = toOrderRow(
      authorizationFixture({
        merchantName: 'Taquería El Sol',
        amountCents: '2900',
        items: [
          { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 3, unitCents: '850' },
          { sku: 'TAC-HORCH', name: 'Horchata', quantity: 1, unitCents: '350' },
        ],
      }),
    );
    expect(row.title).toBe('Taquería El Sol · 4 artículos');
    expect(row.lines.map((line) => [line.name, line.quantity, plain(line.total)])).toEqual([
      ['Orden de tacos al pastor', 3, 'USD 25.50'],
      ['Agua de horchata', 1, 'USD 3.50'],
    ]);
    expect(plain(row.amount)).toBe('USD 29.00');
    expect(row).toMatchObject({ canCancel: true, statusKey: 'status.onHold', tone: 'warning' });
  });

  it('a plain card purchase is just the merchant; a decline adds its short reason and cannot be cancelled', () => {
    setActiveLocale('en-US');
    const row = toOrderRow(
      authorizationFixture({ status: 'DECLINED', declineReason: 'card_frozen', items: [] }),
    );
    expect(row.title).toBe('Corner Grocery');
    expect(row.detail).toBe(
      `Oct 21, 2026, 12:00 PM · ${t('activity.orders.declineShort.card_frozen')}`,
    );
    expect(row.canCancel).toBe(false);
    expect(row.amount).toBe('$12.50');
  });

  it('keeps the stored name of a SKU the catalog no longer has', () => {
    const row = toOrderRow(
      authorizationFixture({
        items: [{ sku: 'OLD-1', name: 'Retired item', quantity: 1, unitCents: '100' }],
      }),
    );
    expect(row.lines[0]?.name).toBe('Retired item');
  });
});

describe('toOrderDetail', () => {
  beforeEach(() => setActiveLocale('en-US'));
  afterEach(() => setActiveLocale('es-MX'));

  const store = {
    merchantName: 'Taquería El Sol',
    amountCents: '2050',
    itemCount: 3,
    items: [
      {
        sku: 'TAC-PASTOR',
        name: 'Al pastor tacos (order)',
        quantity: 2,
        unitPriceCents: '855',
        lineTotalCents: '1710',
      },
      {
        sku: 'TAC-HORCH',
        name: 'Horchata',
        quantity: 1,
        unitPriceCents: '340',
        lineTotalCents: '340',
      },
    ],
  };

  it('every line says quantity × unit price and the API line total; the order keeps its date and status', () => {
    const detail = toOrderDetail(authorizationDetailFixture(store));
    expect(detail.lines.map((line) => [line.name, line.quantityLabel, line.total])).toEqual([
      ['Al pastor tacos (order)', '2 × $8.55', '$17.10'],
      ['Horchata', '1 × $3.40', '$3.40'],
    ]);
    expect(detail.when).toBe('Oct 21, 2026, 12:00 PM');
    expect(detail.amount).toBe('$20.50');
    expect(detail).toMatchObject({
      merchant: 'Taquería El Sol',
      statusKey: 'status.onHold',
      tone: 'warning',
    });
  });

  it('the timeline lists only the steps that happened, oldest first', () => {
    const detail = toOrderDetail(
      authorizationDetailFixture({
        status: 'CAPTURED',
        capturedCents: '1250',
        timeline: {
          createdAt: '2026-10-21T12:00:00.000Z',
          approvedAt: '2026-10-21T12:00:00.000Z',
          declinedAt: null,
          capturedAt: '2026-10-21T12:05:00.000Z',
          reversedAt: null,
        },
      }),
    );
    expect(detail.timeline).toEqual([
      { labelKey: 'activity.detail.timeline.createdAt', when: 'Oct 21, 2026, 12:00 PM' },
      { labelKey: 'activity.detail.timeline.approvedAt', when: 'Oct 21, 2026, 12:00 PM' },
      { labelKey: 'activity.detail.timeline.capturedAt', when: 'Oct 21, 2026, 12:05 PM' },
    ]);
  });

  it('a hold says how much is set aside', () => {
    expect(toOrderDetail(authorizationDetailFixture(store)).outcome).toBe(
      t('activity.detail.outcome.APPROVED', { amount: '$20.50' }),
    );
  });

  it('a posted order says what was charged (the captured amount, not the hold)', () => {
    const detail = toOrderDetail(
      authorizationDetailFixture({ ...store, status: 'CAPTURED', capturedCents: '1995' }),
    );
    expect(detail.outcome).toBe(t('activity.detail.outcome.CAPTURED', { amount: '$19.95' }));
  });

  it('a decline says nothing was charged and why, per reason', () => {
    const detail = toOrderDetail(
      authorizationDetailFixture({ status: 'DECLINED', declineReason: 'insufficient_funds' }),
    );
    expect(detail.outcome).toBe(
      t('activity.detail.outcome.DECLINED', {
        reason: t('activity.detail.declineReason.insufficient_funds'),
      }),
    );
    const frozen = toOrderDetail(
      authorizationDetailFixture({ status: 'DECLINED', declineReason: 'card_frozen' }),
    );
    expect(frozen.outcome).toContain(t('activity.detail.declineReason.card_frozen'));
  });

  it('a decline without a recorded reason still says it was declined', () => {
    const detail = toOrderDetail(
      authorizationDetailFixture({ status: 'DECLINED', declineReason: null }),
    );
    expect(detail.outcome).toBe(
      t('activity.detail.outcome.DECLINED', { reason: t('activity.detail.declineReason.unknown') }),
    );
  });

  it('a cancelled (voided) order says the hold was released', () => {
    expect(toOrderDetail(authorizationDetailFixture({ status: 'REVERSED' })).outcome).toBe(
      t('activity.detail.outcome.REVERSED'),
    );
  });

  it('a hold on hold says when it releases on its own; any other state does not', () => {
    const held = toOrderDetail(
      authorizationDetailFixture({ status: 'APPROVED', expiresAt: '2026-10-28T12:00:00.000Z' }),
    );
    expect(held.holdExpiry).toBe('Oct 28, 2026, 12:00 PM');
    const posted = toOrderDetail(
      authorizationDetailFixture({
        status: 'CAPTURED',
        capturedCents: '100',
        expiresAt: '2026-10-28T12:00:00.000Z',
      }),
    );
    expect(posted.holdExpiry).toBeNull();
    expect(
      toOrderDetail(authorizationDetailFixture({ status: 'APPROVED', expiresAt: null })).holdExpiry,
    ).toBeNull();
  });

  const reversedAt = {
    createdAt: '2026-10-21T12:00:00.000Z',
    approvedAt: '2026-10-21T12:00:00.000Z',
    declinedAt: null,
    capturedAt: null,
    reversedAt: '2026-10-28T12:00:00.000Z',
  };

  it.each([
    ['expired', 'activity.detail.outcome.REVERSED_expired', 'activity.detail.timeline.expiredAt'],
    [
      'admin_release',
      'activity.detail.outcome.REVERSED_admin_release',
      'activity.detail.timeline.adminReleasedAt',
    ],
    ['network', 'activity.detail.outcome.REVERSED', 'activity.detail.timeline.reversedAt'],
    [null, 'activity.detail.outcome.REVERSED', 'activity.detail.timeline.reversedAt'],
  ] as const)(
    'a release by %s says why in the outcome and the timeline',
    (reason, outcomeKey, stepKey) => {
      const detail = toOrderDetail(
        authorizationDetailFixture({
          status: 'REVERSED',
          reversalReason: reason,
          timeline: reversedAt,
        }),
      );
      expect(detail.outcome).toBe(t(outcomeKey));
      expect(detail.timeline.at(-1)).toEqual({ labelKey: stepKey, when: 'Oct 28, 2026, 12:00 PM' });
    },
  );
});

describe('detailFromListItem (the sheet opens at once from the list row)', () => {
  it('carries every field the list knows, priced lines with their totals, and only the "ordered" step', () => {
    const item = authorizationFixture({
      status: 'CAPTURED',
      capturedCents: '1700',
      items: [
        { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 2, unitCents: '850' },
      ],
    });
    expect(detailFromListItem(item, ACCOUNT_ID)).toEqual({
      id: item.id,
      accountId: ACCOUNT_ID,
      status: 'CAPTURED',
      declineReason: null,
      merchantName: 'Corner Grocery',
      merchantMcc: '5411',
      amountCents: '1250',
      capturedCents: '1700',
      itemCount: 2,
      items: [
        {
          sku: 'TAC-PASTOR',
          name: 'Al pastor tacos (order)',
          quantity: 2,
          unitPriceCents: '850',
          lineTotalCents: '1700',
        },
      ],
      timeline: {
        createdAt: item.createdAt,
        approvedAt: null,
        declinedAt: null,
        capturedAt: null,
        reversedAt: null,
      },
      expiresAt: item.expiresAt,
      reversalReason: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  });
});
