import type { AuthorizationStatus, PaymentStatus } from '@acme/contracts';
import type { StatusTone } from '@acme/ui';

export interface StatusLabel {
  /** i18n key of the word shown with the color (docs/brand.md: never color alone). */
  labelKey: string;
  tone: StatusTone;
}

/** Purchases: a hold is "On hold" until the network posts it (captured), or it is released. */
export const AUTHORIZATION_STATUS: Record<AuthorizationStatus, StatusLabel> = {
  APPROVED: { labelKey: 'status.onHold', tone: 'warning' },
  CAPTURED: { labelKey: 'status.posted', tone: 'neutral' },
  DECLINED: { labelKey: 'status.declined', tone: 'danger' },
  REVERSED: { labelKey: 'status.cancelled', tone: 'neutral' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusLabel> = {
  PENDING: { labelKey: 'status.pending', tone: 'warning' },
  CONFIRMED: { labelKey: 'status.confirmed', tone: 'success' },
  FAILED: { labelKey: 'status.failed', tone: 'danger' },
  // Never approved at the bank in time: no money moved, nothing to alarm about.
  EXPIRED: { labelKey: 'status.expired', tone: 'neutral' },
};

const ACTIVITY_STATUS: Record<string, StatusLabel> = {
  ...AUTHORIZATION_STATUS,
  ...PAYMENT_STATUS,
  POSTED: { labelKey: 'status.posted', tone: 'neutral' },
  RELEASED: { labelKey: 'status.released', tone: 'success' },
  APPLIED: { labelKey: 'status.applied', tone: 'neutral' },
};

/**
 * Activity rows carry a free-form status string; known ones get their word and tone, anything
 * else is shown as "Recorded" in neutral rather than as a raw code.
 */
export function activityStatus(status: string): StatusLabel {
  return ACTIVITY_STATUS[status.toUpperCase()] ?? { labelKey: 'status.recorded', tone: 'neutral' };
}
