import { providerPaymentSchema } from '@acme/contracts';
import { describe, expect, it, vi } from 'vitest';
import { deterministicUuid } from '../../../core/ids/deterministic-uuid';
import { fakeCore, fakeTasks } from '../../../core/__tests__/fakes';
import { ProviderService, WEBHOOK_RETRIES } from '../provider.service';

const CREATED_AT = new Date('2026-10-21T12:00:00.000Z');
const SETTLED_AT = new Date('2026-10-21T12:05:00.000Z');
const DEPOSIT = { reference: 'dep-1', amountCents: '25000', purpose: 'deposit' } as const;

function setup() {
  const core = fakeCore();
  const { tasks, asTasks } = fakeTasks();
  const clock = { now: vi.fn(() => CREATED_AT) };
  const service = new ProviderService(core, asTasks, clock, {
    PUBLIC_URL: 'http://localhost:3001/',
  });
  vi.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  return { core, tasks, clock, service };
}

const webhookTask = (id: string) => `webhook:${id}`;

describe('ProviderService.create', () => {
  it('creates a PENDING payment with an approve URL on our public origin', () => {
    const { service, tasks } = setup();
    const payment = service.create(DEPOSIT);

    expect(providerPaymentSchema.parse(payment)).toEqual(payment);
    expect(payment).toEqual({
      id: expect.any(String),
      reference: 'dep-1',
      amountCents: '25000',
      purpose: 'deposit',
      status: 'PENDING',
      approveUrl: `http://localhost:3001/provider/pay/${payment.id}`,
      createdAt: CREATED_AT.toISOString(),
      settledAt: null,
    });
    expect(tasks.schedule).not.toHaveBeenCalled();
  });

  it('is idempotent by reference: the same reference returns the same payment', () => {
    const { service } = setup();
    const first = service.create(DEPOSIT);
    expect(service.create({ ...DEPOSIT })).toEqual(first);
    expect(service.create({ ...DEPOSIT, reference: 'dep-2' }).id).not.toBe(first.id);
  });

  it('refuses the same reference with another amount or purpose (idempotency.key_reused)', () => {
    const { service } = setup();
    service.create(DEPOSIT);
    for (const changed of [
      { ...DEPOSIT, amountCents: '25001' },
      { ...DEPOSIT, purpose: 'repayment' as const },
    ]) {
      expect(() => service.create(changed)).toThrow(
        expect.objectContaining({
          code: 'idempotency.key_reused',
          details: { reference: 'dep-1' },
        }),
      );
    }
  });

  it('settles a payout at once (money leaves to the customer) and sends its webhook', async () => {
    const { core, service, tasks } = setup();
    const payout = service.create({ reference: 'out-1', amountCents: '5000', purpose: 'payout' });
    expect(payout).toMatchObject({ status: 'SUCCEEDED', settledAt: CREATED_AT.toISOString() });

    await tasks.run(webhookTask(payout.id));
    expect(core.notifyPayment).toHaveBeenCalledWith(
      { paymentId: payout.id, reference: 'out-1' },
      {
        idempotencyKey: deterministicUuid(`webhook:${payout.id}`),
        retries: WEBHOOK_RETRIES,
        signal: expect.any(AbortSignal),
      },
    );
  });
});

describe('ProviderService.settle', () => {
  it('moves a PENDING payment to SUCCEEDED or FAILED with its settlement time', () => {
    const { service, clock } = setup();
    const approved = service.create(DEPOSIT);
    const declined = service.create({ ...DEPOSIT, reference: 'dep-2' });
    clock.now.mockReturnValue(SETTLED_AT);

    expect(service.settle(approved.id, 'SUCCEEDED')).toMatchObject({
      status: 'SUCCEEDED',
      settledAt: SETTLED_AT.toISOString(),
      createdAt: CREATED_AT.toISOString(),
    });
    expect(service.settle(declined.id, 'FAILED')).toMatchObject({ status: 'FAILED' });
    expect(service.get(approved.id).status).toBe('SUCCEEDED');
  });

  it('settles only once: a later approve or decline changes nothing and sends no webhook', async () => {
    const { core, service, tasks } = setup();
    const payment = service.create(DEPOSIT);
    service.settle(payment.id, 'SUCCEEDED');
    await tasks.run(webhookTask(payment.id));

    expect(service.settle(payment.id, 'FAILED').status).toBe('SUCCEEDED');
    expect(service.settle(payment.id, 'SUCCEEDED').status).toBe('SUCCEEDED');
    expect(tasks.pending.size).toBe(0);
    expect(core.notifyPayment).toHaveBeenCalledTimes(1);
  });

  it('logs a webhook the core never accepted', async () => {
    const { core, service, tasks } = setup();
    core.notifyPayment.mockResolvedValueOnce({ kind: 'unavailable' });
    const payment = service.create(DEPOSIT);
    service.settle(payment.id, 'FAILED');
    await tasks.run(webhookTask(payment.id));
    expect(service['logger'].error).toHaveBeenCalledWith(
      `webhook for payment ${payment.id} not delivered: unavailable`,
    );
  });

  it('answers common.not_found for an unknown payment', () => {
    const { service } = setup();
    expect(() => service.settle('nope', 'SUCCEEDED')).toThrow(
      expect.objectContaining({ code: 'common.not_found' }),
    );
    expect(() => service.get('nope')).toThrow(
      expect.objectContaining({ code: 'common.not_found' }),
    );
    expect(service.find('nope')).toBeUndefined();
  });

  it('returns copies, so a caller cannot change the stored payment', () => {
    const { service } = setup();
    const payment = service.create(DEPOSIT);
    service.get(payment.id).status = 'SUCCEEDED';
    expect(service.find(payment.id)?.status).toBe('PENDING');
  });
});
