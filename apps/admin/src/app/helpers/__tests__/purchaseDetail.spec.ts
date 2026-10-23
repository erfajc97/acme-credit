import { setActiveLocale } from '@/app/i18n';
import { adminAuthorizationFixture, authorizationFixture } from '@/test/fixtures';
import { productImageSrc, toPurchaseDetail } from '../purchaseDetail';

const NBSP = String.fromCodePoint(0xa0);
const usd = (amount: string) => `USD${NBSP}${amount}`;
const CUSTOMER = { name: 'Ada Lovelace', email: 'ada@example.test' };

beforeEach(() => setActiveLocale('es-MX'));

describe('productImageSrc (the brand illustration of a SKU)', () => {
  it('is /products/<SKU>.svg, with the SKU escaped for a path', () => {
    expect(productImageSrc('TAC-PASTOR')).toBe('/products/TAC-PASTOR.svg');
    expect(productImageSrc('a/b c')).toBe('/products/a%2Fb%20c.svg');
  });
});

describe('toPurchaseDetail (the order as the detail sheet shows it)', () => {
  it('prices every line with its image, qty × unit and line total, and the order total', () => {
    const detail = toPurchaseDetail(adminAuthorizationFixture(), CUSTOMER);
    expect(
      detail.lines.map((line) => [
        line.imageSrc,
        line.name,
        line.quantity,
        line.unit,
        line.subtotal,
      ]),
    ).toEqual([
      ['/products/cafe-americano.svg', 'Americano', 2, usd('3.50'), usd('7.00')],
      ['/products/pan-dulce.svg', 'Concha', 3, usd('12.25'), usd('36.75')],
      ['/products/jugo.svg', 'Orange juice', 1, usd('49.99'), usd('49.99')],
    ]);
    expect(detail.total).toBe(usd('93.74'));
    expect(detail).toMatchObject({ merchant: 'Taquería El Sol', mcc: '5812', customer: CUSTOMER });
  });

  it('a live hold: approved with the held amount, then when it lapses', () => {
    const detail = toPurchaseDetail(adminAuthorizationFixture(), null);
    expect(detail.timeline.map((step) => [step.key, step.labelKey, step.tone])).toEqual([
      ['approved', 'purchaseDetail.timeline.approved', 'success'],
      ['expires', 'purchaseDetail.timeline.expires', 'pending'],
    ]);
    expect(detail.timeline[0]?.params).toEqual({ amount: usd('93.74') });
    expect(detail.timeline[1]?.time).toContain('28 oct 2026');
    expect(detail.captured).toBeNull();
  });

  it('a decline: one step, with the reason in words', () => {
    const detail = toPurchaseDetail(
      authorizationFixture({
        status: 'DECLINED',
        declineReason: 'insufficient_funds',
        expiresAt: null,
      }),
      null,
    );
    expect(detail.timeline).toHaveLength(1);
    expect(detail.timeline[0]).toMatchObject({
      key: 'declined',
      tone: 'danger',
      reasonKey: 'declineReason.insufficient_funds',
    });
  });

  it('a capture: approved, then charged with the captured amount at the last update', () => {
    const detail = toPurchaseDetail(
      authorizationFixture({
        status: 'CAPTURED',
        capturedCents: '1250',
        updatedAt: '2026-10-23T09:15:00.000Z',
      }),
      null,
    );
    expect(detail.timeline.map((step) => step.key)).toEqual(['approved', 'captured']);
    expect(detail.timeline[1]?.params).toEqual({ amount: usd('12.50') });
    expect(detail.timeline[1]?.time).toContain('23 oct 2026');
    expect(detail.captured).toBe(usd('12.50'));
  });

  it('a release: approved, then released with why', () => {
    const detail = toPurchaseDetail(
      authorizationFixture({ status: 'REVERSED', reversalReason: 'admin_release' }),
      null,
    );
    expect(detail.timeline.map((step) => [step.key, step.tone])).toEqual([
      ['approved', 'success'],
      ['released', 'neutral'],
    ]);
    expect(detail.timeline[1]?.reasonKey).toBe('reversalReason.admin_release');
  });

  it('a plain card purchase has no lines and its total is the authorized amount', () => {
    const detail = toPurchaseDetail(authorizationFixture({ items: [] }), null);
    expect(detail.lines).toEqual([]);
    expect(detail.total).toBe(usd('12.50'));
  });
});
