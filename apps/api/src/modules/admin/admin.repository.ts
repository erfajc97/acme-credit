import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

/** Every figure of the back-office dashboard, as one row. */
export interface DashboardTotals {
  /** Accounts per status; a status with no account is absent. */
  accounts_by_status: Record<string, number>;
  collateral_cents: bigint;
  credit_limit_cents: bigint;
  held_cents: bigint;
  posted_debt_cents: bigint;
  approved: number;
  declined: number;
  trial_balance_cents: bigint;
}

/**
 * Read-only aggregates for the back office. The dashboard is ONE statement: each table is
 * scanned once (accounts grouped by status, the last 24 h of authorizations through the
 * `created_at` index, the postings) and the whole thing is one round trip instead of five.
 */
@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardTotals(since: Date): Promise<DashboardTotals> {
    const [totals] = await this.prisma.$queryRaw<DashboardTotals[]>`
      WITH by_status AS (
        SELECT status::text AS status, count(*)::int AS total,
               sum(collateral_cents) AS collateral, sum(credit_limit_cents) AS credit_limit,
               sum(held_cents) AS held, sum(posted_debt_cents) AS posted_debt
          FROM accounts
         GROUP BY status
      ), decisions AS (
        SELECT count(*) FILTER (WHERE status = 'DECLINED')::int AS declined,
               count(*) FILTER (WHERE status <> 'DECLINED')::int AS approved
          FROM authorizations
         WHERE created_at >= ${since}
      )
      SELECT (SELECT COALESCE(jsonb_object_agg(status, total), '{}'::jsonb) FROM by_status)
               AS accounts_by_status,
             (SELECT COALESCE(sum(collateral), 0)::bigint FROM by_status) AS collateral_cents,
             (SELECT COALESCE(sum(credit_limit), 0)::bigint FROM by_status) AS credit_limit_cents,
             (SELECT COALESCE(sum(held), 0)::bigint FROM by_status) AS held_cents,
             (SELECT COALESCE(sum(posted_debt), 0)::bigint FROM by_status) AS posted_debt_cents,
             decisions.approved,
             decisions.declined,
             (SELECT COALESCE(sum(amount_cents), 0)::bigint FROM postings) AS trial_balance_cents
        FROM decisions`;
    if (!totals) throw new Error('the dashboard aggregate returned no row');
    return totals;
  }
}
