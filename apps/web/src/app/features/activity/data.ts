import type { ACTIVITY_TYPES } from '@acme/contracts';

/** The word for each kind of money movement (docs/brand.md › Voice). Keys, not copy. */
export const ACTIVITY_TYPE_LABEL: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  deposit: 'activity.type.deposit',
  purchase: 'activity.type.purchase',
  repayment: 'activity.type.repayment',
  collateral_applied: 'activity.type.collateral_applied',
  collateral_released: 'activity.type.collateral_released',
};
