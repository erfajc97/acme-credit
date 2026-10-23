import type { Account } from '@acme/contracts';

/** Which screen the account home shows, from the account's life cycle. */
export type AccountView = 'none' | 'pendingCollateral' | 'open' | 'closed';

/** An amount form: typed text in, integer cents out (W11). */
export interface AmountFormInput {
  amount: string;
}

export interface AmountFormValues {
  amount: bigint;
}

/** What happened to the security deposit when the account closed. */
export interface SettlementSummary {
  collateralCents: bigint;
  appliedToDebtCents: bigint;
  releasedCents: bigint;
}

export type { Account };

/** Which account page the island renders. */
export type AccountScreenKind = 'home' | 'card';
