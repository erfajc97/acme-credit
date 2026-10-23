import { describe, expect, it, vi } from 'vitest';
import { deterministicUuid } from '../../../core/ids/deterministic-uuid';
import { CAPTURE_RETRIES, CaptureService, REVERSAL_RETRIES } from '../capture.service';
import { AUTH_ID, authorization, fakeCore, fakeTasks } from '../../../core/__tests__/fakes';

const CAPTURE_TASK = `capture:${AUTH_ID}`;
/** The card that made the purchase: the only one that may void it. */
const CARD = 'tok_card_1';
const OWNER = { authorizationId: AUTH_ID, cardToken: CARD };

function setup() {
  const core = fakeCore();
  const { tasks, asTasks } = fakeTasks();
  const service = new CaptureService(core, asTasks, { CAPTURE_DELAY_MS: 4_000 });
  vi.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  return { core, tasks, service };
}

describe('CaptureService.track', () => {
  it('schedules one capture of the authorized amount after CAPTURE_DELAY_MS', async () => {
    const { core, tasks, service } = setup();
    service.track(authorization(), CARD);

    expect(tasks.pending.get(CAPTURE_TASK)?.delayMs).toBe(4_000);
    await tasks.run(CAPTURE_TASK);
    expect(core.capture).toHaveBeenCalledWith(
      AUTH_ID,
      { amountCents: '12550' },
      {
        idempotencyKey: deterministicUuid(`capture:${AUTH_ID}`),
        retries: CAPTURE_RETRIES,
        signal: expect.any(AbortSignal),
      },
    );
  });

  it('does not schedule a second capture when the same approval is replayed', () => {
    const { tasks, service } = setup();
    service.track(authorization(), CARD);
    service.track(authorization(), CARD);
    expect(tasks.schedule).toHaveBeenCalledTimes(1);
  });

  it('never captures a declined authorization', () => {
    const { tasks, service } = setup();
    service.track(authorization({ status: 'DECLINED', declineReason: 'insufficient_funds' }), CARD);
    expect(tasks.schedule).not.toHaveBeenCalled();
  });

  it('logs a capture the core never confirmed, and does not retry it forever', async () => {
    const { core, tasks, service } = setup();
    core.capture.mockResolvedValue({ kind: 'unavailable' });
    service.track(authorization(), CARD);
    await tasks.run(CAPTURE_TASK);
    expect(service['logger'].error).toHaveBeenCalledWith(
      `capture of authorization ${AUTH_ID} not confirmed: unavailable`,
    );
    expect(tasks.pending.size).toBe(0);
  });
});

describe('CaptureService.reverse (void)', () => {
  it('cancels the pending capture and reverses at the core with a derived key', async () => {
    const { core, tasks, service } = setup();
    service.track(authorization(), CARD);

    await service.reverse(OWNER);

    expect(tasks.cancel).toHaveBeenCalledWith(CAPTURE_TASK);
    expect(tasks.pending.has(CAPTURE_TASK)).toBe(false);
    expect(core.reverse).toHaveBeenCalledWith(AUTH_ID, {
      idempotencyKey: deterministicUuid(`reversal:${AUTH_ID}`),
      retries: REVERSAL_RETRIES,
    });
    expect(core.capture).not.toHaveBeenCalled();
  });

  it('refuses with authorization.not_reversible once the capture has run', async () => {
    const { core, tasks, service } = setup();
    service.track(authorization(), CARD);
    await tasks.run(CAPTURE_TASK);
    await expect(service.reverse(OWNER)).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
    expect(core.reverse).not.toHaveBeenCalled();
  });

  it('refuses a declined authorization and a second void', async () => {
    const { service } = setup();
    service.track(
      authorization({ id: 'declined', status: 'DECLINED', declineReason: 'card_frozen' }),
      CARD,
    );
    await expect(
      service.reverse({ authorizationId: 'declined', cardToken: CARD }),
    ).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
    service.track(authorization(), CARD);
    await service.reverse(OWNER);
    await expect(service.reverse(OWNER)).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
  });

  it('answers common.not_found for an authorization this simulator never saw', async () => {
    const { service } = setup();
    await expect(service.reverse(OWNER)).rejects.toMatchObject({ code: 'common.not_found' });
  });

  it('answers common.not_found to another card (attacker who learned the id), touching nothing', async () => {
    const { core, tasks, service } = setup();
    service.track(authorization(), CARD);
    for (const cardToken of ['tok_card_2', `${CARD} `, '']) {
      await expect(service.reverse({ authorizationId: AUTH_ID, cardToken })).rejects.toMatchObject({
        code: 'common.not_found',
      });
    }
    expect(tasks.cancel).not.toHaveBeenCalled();
    expect(core.reverse).not.toHaveBeenCalled();
    // The owner's hold is intact: it is still captured on schedule.
    await tasks.run(CAPTURE_TASK);
    expect(core.capture).toHaveBeenCalledTimes(1);
  });

  it('keeps the capture cancelled when the core is down, and a retried void finishes it', async () => {
    const { core, tasks, service } = setup();
    service.track(authorization(), CARD);
    core.reverse.mockResolvedValueOnce({ kind: 'unavailable' });

    await expect(service.reverse(OWNER)).rejects.toMatchObject({
      code: 'payment.provider_unavailable',
    });
    expect(tasks.pending.has(CAPTURE_TASK)).toBe(false);

    await service.reverse(OWNER);
    expect(core.reverse).toHaveBeenCalledTimes(2);
    expect(core.capture).not.toHaveBeenCalled();
  });

  it('answers not_reversible when the core rejects the reversal', async () => {
    const { core, service } = setup();
    service.track(authorization(), CARD);
    core.reverse.mockResolvedValueOnce({
      kind: 'rejected',
      status: 409,
      code: 'authorization.not_reversible',
    });
    await expect(service.reverse(OWNER)).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
    await expect(service.reverse(OWNER)).rejects.toMatchObject({
      code: 'authorization.not_reversible',
    });
    expect(core.reverse).toHaveBeenCalledTimes(1);
  });
});
