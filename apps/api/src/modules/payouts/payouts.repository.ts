import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PAYOUT_CLAIM_LEASE_MS } from './helpers/payout-rules';

/** A payout this worker owns until its lease ends. */
export interface ClaimedPayout {
  id: string;
  accountId: string;
  amountCents: bigint;
  providerReference: string;
}

@Injectable()
export class PayoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claims due PENDING payouts in ONE statement (P2's outbox pattern): `FOR UPDATE SKIP LOCKED`
   * keeps parallel workers off each other's rows, and the lease pushes `next_attempt_at` out so
   * the outbox handler and the sweep never send the same payout at once. `payoutId` narrows
   * the claim to one payout (the outbox handler); null claims a batch (the sweep).
   */
  claimDue(input: { now: Date; limit: number; payoutId: string | null }): Promise<ClaimedPayout[]> {
    const leaseEnd = new Date(input.now.getTime() + PAYOUT_CLAIM_LEASE_MS);
    return this.prisma.$queryRaw<ClaimedPayout[]>`
      UPDATE payouts
         SET next_attempt_at = ${leaseEnd}
       WHERE id IN (
         SELECT id FROM payouts
          WHERE status = 'PENDING'
            AND next_attempt_at <= ${input.now}
            AND (${input.payoutId}::uuid IS NULL OR id = ${input.payoutId}::uuid)
          ORDER BY next_attempt_at, id
          LIMIT ${input.limit}
          FOR UPDATE SKIP LOCKED)
      RETURNING id::text AS id, account_id::text AS "accountId", amount_cents AS "amountCents",
                provider_reference::text AS "providerReference"`;
  }
}
