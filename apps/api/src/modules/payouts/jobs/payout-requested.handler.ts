import { Injectable } from '@nestjs/common';
import type { ClaimedEvent, OutboxHandler } from '../../../core/outbox/outbox-relay';
import { PayoutsService } from '../payouts.service';

/**
 * Sends a requested payout as soon as the change that reserved it committed (P2). It claims
 * the payout like the sweep does, so the two never send it at once; a payout that is not due
 * (claimed elsewhere, already settled) is left alone. Retries belong to the payouts sweep, not
 * to the outbox: a provider that does not answer is not a failure of this event.
 */
@Injectable()
export class PayoutRequestedHandler implements OutboxHandler {
  readonly type = 'payout.requested';

  constructor(private readonly payouts: PayoutsService) {}

  async handle(event: ClaimedEvent): Promise<void> {
    await this.payouts.sendDue({ now: new Date(), payoutId: payoutIdOf(event) });
  }
}

function payoutIdOf(event: ClaimedEvent): string {
  const payload = event.payload;
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const entityId = payload.entityId;
    if (typeof entityId === 'string') return entityId;
  }
  throw new Error(`outbox event ${event.id} has no entityId`);
}
