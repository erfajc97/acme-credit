import type { PayoutReason } from '../../../generated/prisma/client';
import { recordChange, type Actor } from '../../../core/audit/record-change';
import type { Tx } from '../../../core/database/transaction';
import { centsToString, type Cents } from '../../../core/money/money';

/**
 * Reserves money to send back to the customer: a PENDING payout plus the `payout.requested`
 * outbox event, in the caller's transaction. The worker calls the provider after commit (P2).
 */
export async function requestPayout(
  tx: Tx,
  actor: Actor,
  input: { accountId: string; amountCents: Cents; reason: PayoutReason },
): Promise<string> {
  const payout = await tx.payout.create({
    data: { accountId: input.accountId, amountCents: input.amountCents, reason: input.reason },
    select: { id: true },
  });
  await recordChange(tx, actor, {
    action: 'payout.requested',
    entityType: 'payout',
    entityId: payout.id,
    data: {
      accountId: input.accountId,
      amountCents: centsToString(input.amountCents),
      reason: input.reason,
    },
  });
  return payout.id;
}
