import { idempotencyKeySchema, linesTotalCents, STORE_MERCHANTS } from '@acme/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '../../../core/__tests__/fake-db';
import { InstantPaymentProvider } from '../../../core/payment-provider/instant-payment-provider';
import { DemoDataSeeder } from '../demo-data.seeder';
import {
  DEMO_DEPOSIT_CENTS,
  DEMO_PURCHASES,
  DEMO_REPAYMENT_CENTS,
  demoKey,
} from '../helpers/demo-plan';

const CUSTOMER = '0199a000-0000-7000-8000-0000000000c1';

describe('demo plan', () => {
  it('buys from each of the four store merchants, declines one and leaves one hold', () => {
    const captured = DEMO_PURCHASES.filter((purchase) => purchase.capture);
    expect(new Set(captured.map((purchase) => purchase.merchant.name))).toEqual(
      new Set(Object.values(STORE_MERCHANTS).map((merchant) => merchant.name)),
    );
    for (const purchase of DEMO_PURCHASES.filter((item) => item.items)) {
      expect(linesTotalCents(purchase.items ?? [])).toBe(BigInt(purchase.amountCents));
    }
    const declined = DEMO_PURCHASES.find((purchase) => purchase.step === 'declined');
    expect(BigInt(declined?.amountCents ?? '0')).toBeGreaterThan(BigInt(DEMO_DEPOSIT_CENTS));
    expect(DEMO_PURCHASES.find((purchase) => purchase.step === 'hold')?.capture).toBe(false);
    // The repayment never exceeds what the captured purchases owe.
    const owed = captured.reduce((sum, purchase) => sum + BigInt(purchase.amountCents), 0n);
    expect(BigInt(DEMO_REPAYMENT_CENTS)).toBeLessThanOrEqual(owed);
  });

  it('derives one stable UUID key per customer and step', () => {
    const key = demoKey(CUSTOMER, 'open');
    expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
    expect(demoKey(CUSTOMER, 'open')).toBe(key);
    expect(demoKey(CUSTOMER, 'deposit')).not.toBe(key);
    expect(demoKey('0199a000-0000-7000-8000-0000000000c2', 'open')).not.toBe(key);
  });
});

describe('InstantPaymentProvider (seed only)', () => {
  const now = () => new Date('2026-10-22T12:00:00.000Z');

  it('is idempotent by reference, PENDING until approved, payouts settled at once', async () => {
    const provider = new InstantPaymentProvider('http://localhost:3001', now);
    const created = await provider.createPayment({
      reference: 'd1',
      amountCents: '500000',
      purpose: 'deposit',
    });
    expect(created).toMatchObject({
      id: 'seed_d1',
      status: 'PENDING',
      settledAt: null,
      approveUrl: 'http://localhost:3001/provider/pay/seed_d1',
    });
    expect(
      await provider.createPayment({ reference: 'd1', amountCents: '1', purpose: 'deposit' }),
    ).toBe(created);
    expect(provider.approve('d1')).toBe('seed_d1');
    await expect(provider.getPayment('seed_d1')).resolves.toMatchObject({
      status: 'SUCCEEDED',
      settledAt: '2026-10-22T12:00:00.000Z',
    });
    await expect(
      provider.createPayment({ reference: 'p1', amountCents: '5', purpose: 'payout' }),
    ).resolves.toMatchObject({ status: 'SUCCEEDED' });
  });

  it('does not know what it never created', async () => {
    const provider = new InstantPaymentProvider('http://localhost:3001', now);
    await expect(provider.getPayment('seed_x')).rejects.toMatchObject({
      code: 'payment.not_confirmed',
    });
    expect(() => provider.approve('x')).toThrow('no seed payment');
  });
});

describe('DemoDataSeeder', () => {
  let db: FakeDb;
  let services: {
    accounts: { open: ReturnType<typeof vi.fn> };
    payments: {
      requestDeposit: ReturnType<typeof vi.fn>;
      requestRepayment: ReturnType<typeof vi.fn>;
    };
    settlement: {
      findByReference: ReturnType<typeof vi.fn>;
      handleWebhook: ReturnType<typeof vi.fn>;
    };
    authorizations: { authorize: ReturnType<typeof vi.fn>; capture: ReturnType<typeof vi.fn> };
    provider: { approve: ReturnType<typeof vi.fn> };
  };
  let seeder: DemoDataSeeder;

  beforeEach(() => {
    db = fakeDb();
    db.account.findFirst.mockResolvedValue(null);
    db.idempotencyKey.findUnique.mockResolvedValue(null);
    db.account.findUniqueOrThrow.mockResolvedValue({ cardToken: 'card_demo' });
    services = {
      accounts: { open: vi.fn(async () => ({ id: 'a1' })) },
      payments: {
        requestDeposit: vi.fn(async () => ({ id: 'd1' })),
        requestRepayment: vi.fn(async () => ({ id: 'r1' })),
      },
      settlement: {
        findByReference: vi.fn(async () => ({ settled: false })),
        handleWebhook: vi.fn(async () => undefined),
      },
      authorizations: {
        authorize: vi.fn(async (_actor, _request, input: { amountCents: string }) => ({
          id: `z-${input.amountCents}`,
          status: input.amountCents === '900000' ? 'DECLINED' : 'APPROVED',
        })),
        capture: vi.fn(async () => ({})),
      },
      provider: { approve: vi.fn((reference: string) => `seed_${reference}`) },
    };
    seeder = new DemoDataSeeder(
      db as never,
      services.accounts as never,
      services.payments as never,
      services.settlement as never,
      services.authorizations as never,
      services.provider as never,
    );
  });

  it('runs every step through the real services with deterministic keys', async () => {
    await seeder.seed(CUSTOMER);
    const customer = { type: 'customer', id: CUSTOMER, requestId: null };
    expect(services.accounts.open).toHaveBeenCalledWith(customer, {
      key: demoKey(CUSTOMER, 'open'),
      method: 'POST',
      path: '/v1/accounts',
    });
    expect(services.payments.requestDeposit).toHaveBeenCalledWith({
      actor: customer,
      request: {
        key: demoKey(CUSTOMER, 'deposit'),
        method: 'POST',
        path: '/v1/accounts/a1/deposits',
      },
      accountId: 'a1',
      amountCents: DEMO_DEPOSIT_CENTS,
    });
    // Approved at the "bank", settled by the provider webhook path.
    expect(services.settlement.handleWebhook).toHaveBeenCalledWith(
      { type: 'provider', id: null, requestId: null },
      { paymentId: 'seed_d1', reference: 'd1' },
    );
    expect(services.authorizations.authorize).toHaveBeenCalledTimes(DEMO_PURCHASES.length);
    expect(services.authorizations.authorize).toHaveBeenCalledWith(
      { type: 'network', id: null, requestId: null },
      expect.objectContaining({ key: demoKey(CUSTOMER, 'purchase:taqueria') }),
      expect.objectContaining({ cardToken: 'card_demo', items: expect.any(Array) }),
    );
    // Four captures: neither the decline nor the live hold is captured.
    expect(services.authorizations.capture).toHaveBeenCalledTimes(4);
    expect(services.payments.requestRepayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: DEMO_REPAYMENT_CENTS }),
    );
    expect(services.provider.approve).toHaveBeenCalledWith('r1');
  });

  it('does not approve a payment that is already settled (a re-run replays)', async () => {
    services.settlement.findByReference.mockResolvedValue({ settled: true });
    await seeder.seed(CUSTOMER);
    expect(services.provider.approve).not.toHaveBeenCalled();
    expect(services.settlement.handleWebhook).not.toHaveBeenCalled();
  });

  it('leaves alone a demo customer whose account the seed did not open', async () => {
    db.account.findFirst.mockResolvedValue({ id: 'own' });
    await seeder.seed(CUSTOMER);
    expect(services.accounts.open).not.toHaveBeenCalled();
    // …but resumes its own history when the seed opened that account.
    db.idempotencyKey.findUnique.mockResolvedValue({ id: 'k-open' });
    await seeder.seed(CUSTOMER);
    expect(services.accounts.open).toHaveBeenCalledTimes(1);
  });

  it('stops when the deposit did not issue a card', async () => {
    db.account.findUniqueOrThrow.mockResolvedValue({ cardToken: null });
    await expect(seeder.seed(CUSTOMER)).rejects.toThrow('no card');
  });
});
