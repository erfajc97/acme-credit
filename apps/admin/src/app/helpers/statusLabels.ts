import type {
  AccountStatus,
  AdminPayout,
  AuditLogEntry,
  AuthorizationStatus,
  DeclineReason,
  FreezeActor,
  FreezeReason,
  PayoutStatus,
  ReversalReason,
} from '@acme/contracts';
import type { StatusTone } from '@acme/ui';

export interface StatusLabel {
  /** i18n key of the word shown with the color (docs/brand.md: never color alone). */
  labelKey: string;
  tone: StatusTone;
}

export const ACCOUNT_STATUS: Record<AccountStatus, StatusLabel> = {
  PENDING_COLLATERAL: { labelKey: 'status.account.PENDING_COLLATERAL', tone: 'warning' },
  ACTIVE: { labelKey: 'status.account.ACTIVE', tone: 'success' },
  FROZEN: { labelKey: 'status.account.FROZEN', tone: 'warning' },
  CLOSED: { labelKey: 'status.account.CLOSED', tone: 'neutral' },
};

/** A hold is "On hold" until the network posts it (captured) or reverses it. */
export const AUTHORIZATION_STATUS: Record<AuthorizationStatus, StatusLabel> = {
  APPROVED: { labelKey: 'status.authorization.APPROVED', tone: 'warning' },
  CAPTURED: { labelKey: 'status.authorization.CAPTURED', tone: 'neutral' },
  DECLINED: { labelKey: 'status.authorization.DECLINED', tone: 'danger' },
  REVERSED: { labelKey: 'status.authorization.REVERSED', tone: 'neutral' },
};

/** Why the network was told "no", in words. */
export const DECLINE_REASON: Record<DeclineReason, string> = {
  insufficient_funds: 'declineReason.insufficient_funds',
  account_not_active: 'declineReason.account_not_active',
  card_frozen: 'declineReason.card_frozen',
  invalid_card: 'declineReason.invalid_card',
};

export const ACTOR_TYPE: Record<AuditLogEntry['actorType'], string> = {
  customer: 'actor.customer',
  admin: 'actor.admin',
  network: 'actor.network',
  provider: 'actor.provider',
  system: 'actor.system',
};

/** Why a hold was released without a capture, in words. */
export const REVERSAL_REASON: Record<ReversalReason, string> = {
  network: 'reversalReason.network',
  expired: 'reversalReason.expired',
  admin_release: 'reversalReason.admin_release',
};

/** A payout is "Sending" while the worker retries it; FAILED needs a person. */
export const PAYOUT_STATUS: Record<PayoutStatus, StatusLabel> = {
  PENDING: { labelKey: 'status.payout.PENDING', tone: 'warning' },
  SENT: { labelKey: 'status.payout.SENT', tone: 'success' },
  FAILED: { labelKey: 'status.payout.FAILED', tone: 'danger' },
};

export const PAYOUT_REASON: Record<AdminPayout['reason'], string> = {
  collateral_release: 'payoutReason.collateral_release',
  repayment_refund: 'payoutReason.repayment_refund',
  deposit_refund: 'payoutReason.deposit_refund',
};

export const FREEZE_REASON: Record<FreezeReason, string> = {
  customer_request: 'freezeReason.customer_request',
  admin_review: 'freezeReason.admin_review',
  suspected_fraud: 'freezeReason.suspected_fraud',
  collections: 'freezeReason.collections',
};

export const FREEZE_ACTOR: Record<FreezeActor, string> = {
  CUSTOMER: 'freezeActor.CUSTOMER',
  ADMIN: 'freezeActor.ADMIN',
};
