import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import type { PageWindow } from '../../core/http/pagination';

export interface ActivityRow {
  id: string;
  type: 'deposit' | 'purchase' | 'repayment' | 'collateral_applied' | 'collateral_released';
  status: string;
  amount_cents: bigint;
  description: string;
  /** The merchant of a purchase; null for every other type. */
  merchant_name: string | null;
  /** Order lines of a store purchase (jsonb, validated by the service); `[]` otherwise. */
  items: Prisma.JsonValue;
  created_at: Date;
}

/**
 * The customer's activity: deposits, purchases (declined ones too), repayments and the
 * collateral movements of a close, newest first (`created_at DESC, id DESC`), in numbered pages.
 *
 * Trade-off: OFFSET pagination over a UNION. Each source is ordered and cut to `skip + take` on
 * its own (index `(account_id, created_at DESC, id DESC)` of each table), so page N reads at most
 * 4 × N × pageSize rows and the outer query skips the first `skip` of the merge. That grows with
 * the page number, which is fine at one account's history (hundreds of rows); keyset would be
 * flat but cannot jump to page N, which the owner asked for. Ids stay `uuid` so the tiebreaker
 * orders the same way in every branch.
 */
@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(accountId: string, { skip, take }: PageWindow): Promise<ActivityRow[]> {
    const perSource = skip + take;
    return this.prisma.$queryRaw<ActivityRow[]>`
      SELECT id::text AS id, type, status, amount_cents, description, merchant_name, items,
             created_at
        FROM (
          (SELECT id, 'deposit' AS type, status::text AS status, amount_cents,
                  'Collateral deposit' AS description, NULL::text AS merchant_name,
                  '[]'::jsonb AS items, created_at
             FROM collateral_deposits
            WHERE account_id = ${accountId}::uuid
            ORDER BY created_at DESC, id DESC LIMIT ${perSource})
          UNION ALL
          (SELECT id, 'purchase', status::text,
                  CASE WHEN status = 'CAPTURED' THEN captured_cents ELSE amount_cents END,
                  merchant_name, merchant_name, items, created_at
             FROM authorizations
            WHERE account_id = ${accountId}::uuid
            ORDER BY created_at DESC, id DESC LIMIT ${perSource})
          UNION ALL
          (SELECT id, 'repayment', status::text, amount_cents, 'Repayment', NULL, '[]'::jsonb,
                  created_at
             FROM repayments
            WHERE account_id = ${accountId}::uuid
            ORDER BY created_at DESC, id DESC LIMIT ${perSource})
          UNION ALL
          (SELECT j.id, j.kind, 'POSTED', p.amount_cents, j.description, NULL, '[]'::jsonb,
                  j.created_at
             FROM (SELECT id, kind::text AS kind, description, created_at
                     FROM journal_entries
                    WHERE account_id = ${accountId}::uuid
                      AND kind IN ('collateral_applied', 'collateral_released')
                    ORDER BY created_at DESC, id DESC LIMIT ${perSource}) j
             JOIN postings p ON p.entry_id = j.id AND p.amount_cents > 0)
        ) activity
       ORDER BY created_at DESC, id DESC
       LIMIT ${take} OFFSET ${skip}`;
  }

  /** Rows `list` can return over every page: each source counted with the same filter, summed. */
  async count(accountId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<[{ total: bigint }]>`
      SELECT (SELECT count(*) FROM collateral_deposits WHERE account_id = ${accountId}::uuid)
           + (SELECT count(*) FROM authorizations WHERE account_id = ${accountId}::uuid)
           + (SELECT count(*) FROM repayments WHERE account_id = ${accountId}::uuid)
           + (SELECT count(*)
                FROM journal_entries j
                JOIN postings p ON p.entry_id = j.id AND p.amount_cents > 0
               WHERE j.account_id = ${accountId}::uuid
                 AND j.kind IN ('collateral_applied', 'collateral_released')) AS total`;
    // A count of one account's rows is far below 2^53.
    return Number(row.total);
  }
}
