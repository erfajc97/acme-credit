import { describe, expect, it, vi } from 'vitest';
import type { CaptureService } from '../capture.service';
import { CheckoutService } from '../checkout.service';
import { AUTHORIZATION_RETRIES, PurchasesService } from '../purchases.service';
import { AUTH_ID, authorization, fakeCore, KEY } from '../../../core/__tests__/fakes';

const REQUEST = {
  cardToken: 'tok_card_1',
  merchant: 'taqueria' as const,
  items: [
    { sku: 'TAC-PASTOR', quantity: 2 },
    { sku: 'TAC-HORCH', quantity: 1 },
  ],
};
const LINES = [
  { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 2, unitCents: '850' },
  { sku: 'TAC-HORCH', name: 'Horchata', quantity: 1, unitCents: '350' },
];

function setup() {
  const core = fakeCore();
  core.authorize.mockImplementation((body) =>
    Promise.resolve({
      kind: 'ok',
      value: authorization({
        amountCents: body.amountCents,
        merchantName: body.merchant.name,
        merchantMcc: body.merchant.mcc,
        items: body.items ?? [],
      }),
    }),
  );
  const captures = { track: vi.fn(), reverse: vi.fn(() => Promise.resolve()) };
  const purchases = new PurchasesService(core, captures as unknown as CaptureService);
  vi.spyOn(purchases['logger'], 'error').mockImplementation(() => undefined);
  return { core, captures, service: new CheckoutService(purchases) };
}

describe('CheckoutService.checkout', () => {
  it('prices the cart from the catalog and forwards it as a keyed authorization with its lines', async () => {
    const { core, captures, service } = setup();
    const result = await service.checkout({ idempotencyKey: KEY, request: REQUEST });

    expect(result).toEqual({
      authorizationId: AUTH_ID,
      status: 'APPROVED',
      declineReason: null,
      availableCents: null,
      merchantName: 'Taquería El Sol',
      totalCents: '2050',
      lines: LINES,
    });
    expect(core.authorize).toHaveBeenCalledWith(
      {
        cardToken: 'tok_card_1',
        amountCents: '2050',
        merchant: { name: 'Taquería El Sol', mcc: '5812' },
        items: LINES,
      },
      { idempotencyKey: KEY, retries: AUTHORIZATION_RETRIES },
    );
    expect(captures.track).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown SKU or a SKU of another merchant with validation_failed unknown_sku, before the core', async () => {
    const { core, service } = setup();
    for (const sku of ['NOPE', 'MKT-COFFEE']) {
      await expect(
        service.checkout({
          idempotencyKey: KEY,
          request: { ...REQUEST, items: [{ sku, quantity: 1 }] },
        }),
      ).rejects.toMatchObject({
        code: 'common.validation_failed',
        details: { reason: 'unknown_sku' },
      });
    }
    expect(core.authorize).not.toHaveBeenCalled();
  });

  it('maps a decline with its reason', async () => {
    const { core, service } = setup();
    core.authorize.mockResolvedValueOnce({
      kind: 'ok',
      value: authorization({ status: 'DECLINED', declineReason: 'card_frozen' }),
    });
    await expect(
      service.checkout({ idempotencyKey: KEY, request: REQUEST }),
    ).resolves.toMatchObject({ status: 'DECLINED', declineReason: 'card_frozen' });
  });

  it('replays the same key and cart; another cart with the key → idempotency.key_reused', async () => {
    const { core, service } = setup();
    const first = await service.checkout({ idempotencyKey: KEY, request: REQUEST });
    await expect(
      service.checkout({ idempotencyKey: KEY, request: { ...REQUEST } }),
    ).resolves.toEqual(first);
    for (const request of [
      { ...REQUEST, items: [{ sku: 'TAC-PASTOR', quantity: 3 }] },
      { ...REQUEST, cardToken: 'tok_card_2' },
    ]) {
      await expect(service.checkout({ idempotencyKey: KEY, request })).rejects.toMatchObject({
        code: 'idempotency.key_reused',
      });
    }
    expect(core.authorize).toHaveBeenCalledTimes(1);
  });

  it('binds the key to the quantities: the same SKUs with one more horchata → key_reused, one core call', async () => {
    const { core, service } = setup();
    await service.checkout({ idempotencyKey: KEY, request: REQUEST });
    const moreHorchata = {
      ...REQUEST,
      items: [
        { sku: 'TAC-PASTOR', quantity: 2 },
        { sku: 'TAC-HORCH', quantity: 2 },
      ],
    };
    await expect(
      service.checkout({ idempotencyKey: KEY, request: moreHorchata }),
    ).rejects.toMatchObject({ code: 'idempotency.key_reused' });
    expect(core.authorize).toHaveBeenCalledTimes(1);
  });

  it('answers payment.provider_unavailable when the core stays down', async () => {
    const { core, captures, service } = setup();
    core.authorize.mockResolvedValueOnce({ kind: 'unavailable' });
    await expect(service.checkout({ idempotencyKey: KEY, request: REQUEST })).rejects.toMatchObject(
      { code: 'payment.provider_unavailable' },
    );
    expect(captures.track).not.toHaveBeenCalled();
  });
});
