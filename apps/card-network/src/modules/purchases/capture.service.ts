import { createHash, timingSafeEqual } from 'node:crypto';
import type { Authorization } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BackgroundTasks } from '../../core/background/background-tasks';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { CORE_CLIENT, type CoreClient } from '../../core/core-client/core-client.port';
import { deterministicUuid } from '../../core/ids/deterministic-uuid';

/** Attempts after the first one. The capture runs in the background, so it can wait longer. */
export const CAPTURE_RETRIES = 5;
export const REVERSAL_RETRIES = 3;

/**
 * Life of a hold as the merchant side sees it:
 * `scheduled` → `capturing` → `captured` | `capture_failed`;
 * `scheduled` → `reversing` → `reversed` | `not_reversible`. A declined purchase starts at
 * `not_reversible`. `reversing` survives an unknown reversal outcome: the capture is already
 * cancelled, and a retried void finishes the reversal with the same key.
 */
type HoldState =
  | 'scheduled'
  | 'capturing'
  | 'captured'
  | 'capture_failed'
  | 'reversing'
  | 'reversed'
  | 'not_reversible';

interface Hold {
  amountCents: string;
  state: HoldState;
  /** SHA-256 of the card that made the purchase: the capability to void it. */
  cardDigest: Buffer;
}

const digestOf = (cardToken: string) => createHash('sha256').update(cardToken).digest();

const captureTask = (authorizationId: string) => `capture:${authorizationId}`;

/**
 * The merchant acquirer's settlement: every approved purchase is captured once, after
 * CAPTURE_DELAY_MS, unless it is voided first. In memory: a restart forgets pending
 * captures (the core keeps the holds).
 */
@Injectable()
export class CaptureService {
  private readonly logger = new Logger(CaptureService.name);
  private readonly holds = new Map<string, Hold>();

  constructor(
    @Inject(CORE_CLIENT) private readonly core: CoreClient,
    private readonly tasks: BackgroundTasks,
    @Inject(ENV) private readonly env: Pick<Env, 'CAPTURE_DELAY_MS'>,
  ) {}

  /** Records the core's decision; an approval gets its capture scheduled exactly once. */
  track(authorization: Authorization, cardToken: string): void {
    if (this.holds.has(authorization.id)) return;
    const approved = authorization.status === 'APPROVED';
    this.holds.set(authorization.id, {
      amountCents: authorization.amountCents,
      state: approved ? 'scheduled' : 'not_reversible',
      cardDigest: digestOf(cardToken),
    });
    if (!approved) return;
    this.tasks.schedule(captureTask(authorization.id), this.env.CAPTURE_DELAY_MS, (signal) =>
      this.capture(authorization.id, signal),
    );
  }

  /**
   * Voids a hold whose capture has not happened yet (reversal at the core). Only the card the
   * core approved the hold for may void it; any other card gets the same 404 as an unknown id,
   * checked before anything changes (A7: a foreign resource is not revealed).
   */
  async reverse(input: { authorizationId: string; cardToken: string }): Promise<void> {
    const { authorizationId } = input;
    const hold = this.holds.get(authorizationId);
    if (!hold || !timingSafeEqual(hold.cardDigest, digestOf(input.cardToken))) {
      throw new AppHttpException('common.not_found');
    }
    if (hold.state === 'scheduled') {
      this.tasks.cancel(captureTask(authorizationId));
      hold.state = 'reversing';
    }
    if (hold.state !== 'reversing') {
      throw new AppHttpException('authorization.not_reversible', { authorizationId });
    }

    const result = await this.core.reverse(authorizationId, {
      idempotencyKey: deterministicUuid(`reversal:${authorizationId}`),
      retries: REVERSAL_RETRIES,
    });
    if (result.kind === 'unavailable') throw new AppHttpException('payment.provider_unavailable');
    if (result.kind === 'rejected') {
      hold.state = 'not_reversible';
      throw new AppHttpException('authorization.not_reversible', { authorizationId });
    }
    hold.state = 'reversed';
  }

  private async capture(authorizationId: string, signal: AbortSignal): Promise<void> {
    const hold = this.holds.get(authorizationId);
    if (hold?.state !== 'scheduled') return;
    hold.state = 'capturing';
    const result = await this.core.capture(
      authorizationId,
      { amountCents: hold.amountCents },
      {
        idempotencyKey: deterministicUuid(`capture:${authorizationId}`),
        retries: CAPTURE_RETRIES,
        signal,
      },
    );
    hold.state = result.kind === 'ok' ? 'captured' : 'capture_failed';
    if (result.kind !== 'ok') {
      // Unknown is not "no" (MO4): nothing is undone here; the hold stays at the core.
      this.logger.error(
        `capture of authorization ${authorizationId} not confirmed: ${result.kind}`,
      );
    }
  }
}
