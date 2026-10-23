import { ApiError } from '../apiClient';
import {
  acquireIdempotencyKey,
  IDEMPOTENCY_TTL_MS,
  idempotencySlot,
  isDefinitiveFailure,
  releaseIdempotencyKey,
  withIdempotencyKey,
} from '../idempotency';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const T0 = Date.UTC(2026, 9, 21, 12, 0, 0);

describe('acquireIdempotencyKey (MO2: the key survives reloads)', () => {
  it('persists a UUID per intent and returns the same one on a retry', () => {
    const key = acquireIdempotencyKey(
      'deposit.create',
      { accountId: 'a', amountCents: '25000' },
      T0,
    );
    expect(key).toMatch(UUID);
    // A reload loses memory but not sessionStorage: the same intent finds the same key.
    expect(
      window.sessionStorage.getItem(
        idempotencySlot('deposit.create', { accountId: 'a', amountCents: '25000' }),
      ),
    ).toContain(key);
    expect(
      acquireIdempotencyKey('deposit.create', { amountCents: '25000', accountId: 'a' }, T0 + 1000),
    ).toBe(key);
  });

  it('gives another payload or another action its own key (a different intent is not a retry)', () => {
    const key = acquireIdempotencyKey(
      'deposit.create',
      { accountId: 'a', amountCents: '25000' },
      T0,
    );
    expect(
      acquireIdempotencyKey('deposit.create', { accountId: 'a', amountCents: '25001' }, T0),
    ).not.toBe(key);
    expect(
      acquireIdempotencyKey('repayment.create', { accountId: 'a', amountCents: '25000' }, T0),
    ).not.toBe(key);
  });

  it('reuses the key until the last millisecond of 24 h and replaces it from then on', () => {
    const payload = { accountId: 'a' };
    const key = acquireIdempotencyKey('account.freeze', payload, T0);
    expect(acquireIdempotencyKey('account.freeze', payload, T0 + IDEMPOTENCY_TTL_MS - 1)).toBe(key);
    expect(acquireIdempotencyKey('account.freeze', payload, T0 + IDEMPOTENCY_TTL_MS)).not.toBe(key);
  });

  it('replaces a corrupted or foreign slot instead of sending it', () => {
    const payload = { accountId: 'a' };
    window.sessionStorage.setItem(idempotencySlot('account.close', payload), '{not json');
    const first = acquireIdempotencyKey('account.close', payload, T0);
    expect(first).toMatch(UUID);
    window.sessionStorage.setItem(
      idempotencySlot('account.close', payload),
      JSON.stringify({ key: 42 }),
    );
    expect(acquireIdempotencyKey('account.close', payload, T0)).not.toBe(first);
  });

  it('keeps working in memory when sessionStorage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    try {
      const key = acquireIdempotencyKey('purchase.create', { amountCents: '100' }, T0);
      expect(acquireIdempotencyKey('purchase.create', { amountCents: '100' }, T0)).toBe(key);
      releaseIdempotencyKey('purchase.create', { amountCents: '100' });
      expect(acquireIdempotencyKey('purchase.create', { amountCents: '100' }, T0)).not.toBe(key);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
      removeItem.mockRestore();
    }
  });
});

describe('isDefinitiveFailure (when may the key be dropped?)', () => {
  it.each([
    ['a decided 4xx', new ApiError(422, 'deposit.amount_out_of_range'), true],
    ['a 4xx without code', new ApiError(400, null), true],
    ['still in progress', new ApiError(409, 'idempotency.in_progress'), false],
    ['another operation in progress', new ApiError(409, 'operation.in_progress'), false],
    ['rate limited', new ApiError(429, 'common.rate_limited'), false],
    ['a 5xx (unknown outcome)', new ApiError(500, 'common.internal'), false],
    ['the last 4xx status', new ApiError(499, null), true],
    ['no answer at all', new ApiError(0, null), false],
    ['a 3xx-like status', new ApiError(399, null), false],
    ['not an API error', new TypeError('boom'), false],
  ])('%s → %s', (_name, error, expected) => {
    expect(isDefinitiveFailure(error)).toBe(expected);
  });
});

describe('withIdempotencyKey', () => {
  const intent = { action: 'deposit.create', payload: { accountId: 'a', amountCents: '25000' } };

  it('sends the same key on a retry after an unknown outcome, then drops it after success', async () => {
    const sent: string[] = [];
    await expect(
      withIdempotencyKey(intent, async (key) => {
        sent.push(key);
        throw new ApiError(0, null);
      }),
    ).rejects.toMatchObject({ status: 0 });
    await expect(
      withIdempotencyKey(intent, async (key) => {
        sent.push(key);
        throw new ApiError(503, 'payment.provider_unavailable');
      }),
    ).rejects.toMatchObject({ code: 'payment.provider_unavailable' });
    await withIdempotencyKey(intent, async (key) => {
      sent.push(key);
      return 'ok';
    });
    expect(new Set(sent).size).toBe(1);
    // After the definitive answer, the next identical intent is a new operation.
    const next = await withIdempotencyKey(intent, async (key) => key);
    expect(next).not.toBe(sent[0]);
  });

  it('drops the key after a decided 4xx', async () => {
    let first = '';
    await expect(
      withIdempotencyKey(intent, async (key) => {
        first = key;
        throw new ApiError(422, 'deposit.amount_out_of_range');
      }),
    ).rejects.toMatchObject({ code: 'deposit.amount_out_of_range' });
    expect(await withIdempotencyKey(intent, async (key) => key)).not.toBe(first);
  });
});
