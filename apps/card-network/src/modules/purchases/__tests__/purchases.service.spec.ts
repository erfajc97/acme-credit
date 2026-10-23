import { describe, expect, it, vi } from 'vitest';
import type { CaptureService } from '../capture.service';
import { AUTHORIZATION_RETRIES, PurchasesService } from '../purchases.service';
import { AUTH_ID, authorization, fakeCore, KEY, OTHER_KEY } from '../../../core/__tests__/fakes';

const REQUEST = {
  cardToken: 'tok_card_1',
  amountCents: '12550',
  merchant: { name: 'Corner Grocery', mcc: '5411' },
};

function setup() {
  const core = fakeCore();
  const captures = { track: vi.fn(), reverse: vi.fn(() => Promise.resolve()) };
  const service = new PurchasesService(core, captures as unknown as CaptureService);
  vi.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  return { core, captures, service };
}

describe('PurchasesService.purchase', () => {
  it('forwards the purchase with the browser key and maps the decision (availableCents null)', async () => {
    const { core, captures, service } = setup();
    const result = await service.purchase({ idempotencyKey: KEY, request: REQUEST });

    expect(result).toEqual({
      authorizationId: AUTH_ID,
      status: 'APPROVED',
      declineReason: null,
      availableCents: null,
    });
    expect(core.authorize).toHaveBeenCalledWith(REQUEST, {
      idempotencyKey: KEY,
      retries: AUTHORIZATION_RETRIES,
    });
    // The hold remembers the card that made it: only that card may void it.
    expect(captures.track).toHaveBeenCalledWith(authorization(), REQUEST.cardToken);
  });

  it('maps a decline with its reason', async () => {
    const { core, service } = setup();
    core.authorize.mockResolvedValueOnce({
      kind: 'ok',
      value: authorization({ status: 'DECLINED', declineReason: 'insufficient_funds' }),
    });
    await expect(
      service.purchase({ idempotencyKey: KEY, request: REQUEST }),
    ).resolves.toMatchObject({
      status: 'DECLINED',
      declineReason: 'insufficient_funds',
    });
  });

  it('replays the same key and body without calling the core again', async () => {
    const { core, captures, service } = setup();
    const first = await service.purchase({ idempotencyKey: KEY, request: REQUEST });
    const again = await service.purchase({ idempotencyKey: KEY, request: { ...REQUEST } });
    expect(again).toEqual(first);
    expect(core.authorize).toHaveBeenCalledTimes(1);
    expect(captures.track).toHaveBeenCalledTimes(1);
  });

  it('rejects the same key with another amount with idempotency.key_reused', async () => {
    const { core, service } = setup();
    await service.purchase({ idempotencyKey: KEY, request: REQUEST });
    for (const request of [
      { ...REQUEST, amountCents: '12551' },
      { ...REQUEST, cardToken: 'tok_card_2' },
      { ...REQUEST, merchant: { name: 'City Fuel', mcc: '5411' } },
      { ...REQUEST, merchant: { name: 'Corner Grocery', mcc: '5541' } },
    ]) {
      await expect(service.purchase({ idempotencyKey: KEY, request })).rejects.toMatchObject({
        code: 'idempotency.key_reused',
      });
    }
    expect(core.authorize).toHaveBeenCalledTimes(1);
  });

  it('answers payment.provider_unavailable when the core stays down, and lets the same key retry', async () => {
    const { core, captures, service } = setup();
    core.authorize.mockResolvedValueOnce({ kind: 'unavailable' });
    await expect(service.purchase({ idempotencyKey: KEY, request: REQUEST })).rejects.toMatchObject(
      {
        code: 'payment.provider_unavailable',
      },
    );
    expect(captures.track).not.toHaveBeenCalled();

    await expect(
      service.purchase({ idempotencyKey: KEY, request: REQUEST }),
    ).resolves.toMatchObject({
      status: 'APPROVED',
    });
    expect(core.authorize).toHaveBeenCalledTimes(2);
  });

  it('passes a key_reused or validation rejection from the core through with its code', async () => {
    const { core, service } = setup();
    core.authorize.mockResolvedValueOnce({
      kind: 'rejected',
      status: 409,
      code: 'idempotency.key_reused',
    });
    await expect(service.purchase({ idempotencyKey: KEY, request: REQUEST })).rejects.toMatchObject(
      {
        code: 'idempotency.key_reused',
      },
    );
    core.authorize.mockResolvedValueOnce({
      kind: 'rejected',
      status: 422,
      code: 'common.validation_failed',
    });
    await expect(service.purchase({ idempotencyKey: KEY, request: REQUEST })).rejects.toMatchObject(
      {
        code: 'common.validation_failed',
      },
    );
  });

  it('turns any other core rejection (our signature refused) into 503 and logs it', async () => {
    const { core, service } = setup();
    for (const rejection of [
      { kind: 'rejected', status: 401, code: 'signature.invalid' },
      { kind: 'rejected', status: 404, code: null },
    ] as const) {
      core.authorize.mockResolvedValueOnce(rejection);
      await expect(
        service.purchase({ idempotencyKey: KEY, request: REQUEST }),
      ).rejects.toMatchObject({
        code: 'payment.provider_unavailable',
      });
    }
    expect(service['logger'].error).toHaveBeenCalledTimes(2);
  });
});

describe('PurchasesService.void', () => {
  const VOID = { idempotencyKey: KEY, authorizationId: AUTH_ID, cardToken: REQUEST.cardToken };

  it('reverses the authorization with the card that asks, and answers REVERSED', async () => {
    const { captures, service } = setup();
    await expect(service.void(VOID)).resolves.toEqual({
      authorizationId: AUTH_ID,
      status: 'REVERSED',
      declineReason: null,
      availableCents: null,
    });
    expect(captures.reverse).toHaveBeenCalledWith({
      authorizationId: AUTH_ID,
      cardToken: REQUEST.cardToken,
    });
  });

  it('replays a void with the same key, and refuses a purchase key reused for a void', async () => {
    const { captures, service } = setup();
    await service.void(VOID);
    await service.void({ ...VOID });
    expect(captures.reverse).toHaveBeenCalledTimes(1);

    await service.purchase({ idempotencyKey: OTHER_KEY, request: REQUEST });
    await expect(service.void({ ...VOID, idempotencyKey: OTHER_KEY })).rejects.toMatchObject({
      code: 'idempotency.key_reused',
    });
  });

  it('never replays a void to another card that reuses its key', async () => {
    const { captures, service } = setup();
    await service.void(VOID);
    await expect(service.void({ ...VOID, cardToken: 'tok_card_2' })).rejects.toMatchObject({
      code: 'idempotency.key_reused',
    });
    expect(captures.reverse).toHaveBeenCalledTimes(1);
  });
});
