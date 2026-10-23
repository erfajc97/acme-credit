import { describe, expect, it, vi } from 'vitest';
import { PayoutRequestedHandler } from '../jobs/payout-requested.handler';

const event = (payload: unknown) => ({
  id: 'e1',
  type: 'payout.requested',
  payload: payload as never,
  attempts: 1,
});

describe('PayoutRequestedHandler (P2)', () => {
  it('sends the requested payout through the payouts path, claimed by its id', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date('2026-10-22T12:00:00.000Z');
    vi.setSystemTime(now);
    const payouts = { sendDue: vi.fn(async () => 1) };
    const subject = new PayoutRequestedHandler(payouts as never);
    expect(subject.type).toBe('payout.requested');
    await subject.handle(event({ entityId: 'p1' }));
    expect(payouts.sendDue).toHaveBeenCalledWith({ now, payoutId: 'p1' });
    vi.useRealTimers();
  });

  it('fails (to be retried and reported) on a malformed event', async () => {
    const subject = new PayoutRequestedHandler({ sendDue: vi.fn() } as never);
    await expect(subject.handle(event({}))).rejects.toThrow('has no entityId');
    await expect(subject.handle(event(['x']))).rejects.toThrow('has no entityId');
  });
});
