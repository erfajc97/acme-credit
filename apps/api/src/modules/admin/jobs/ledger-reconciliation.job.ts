import { Injectable, Logger } from '@nestjs/common';
import { LedgerReconciliation, mismatchesOf } from '../../../core/ledger/reconciliation';

/**
 * Worker job: compares every account's cached balances with its journal and logs an error ONCE
 * per mismatch fingerprint (OB5: a drift that persists is one fact, not one alert per tick). A
 * fingerprint that disappears is forgotten, so the same drift coming back is reported again.
 * Logs carry the account id and the fields only, never amounts (OB3).
 */
@Injectable()
export class LedgerReconciliationJob {
  private readonly logger = new Logger(LedgerReconciliationJob.name);
  private reported = new Set<string>();

  constructor(private readonly reconciliation: LedgerReconciliation) {}

  /** Returns how many accounts disagree with the journal right now. */
  async runOnce(): Promise<number> {
    const mismatches = mismatchesOf(await this.reconciliation.balances());
    for (const mismatch of mismatches) {
      if (this.reported.has(mismatch.fingerprint)) continue;
      this.logger.error(
        {
          event: 'ledger_reconciliation_mismatch',
          accountId: mismatch.accountId,
          fields: mismatch.fields,
          fingerprint: mismatch.fingerprint,
        },
        'cached balance differs from the journal',
      );
    }
    this.reported = new Set(mismatches.map((mismatch) => mismatch.fingerprint));
    return mismatches.length;
  }
}
