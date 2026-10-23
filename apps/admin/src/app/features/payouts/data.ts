import { PAYOUT_STATUSES } from '@acme/contracts';
import { PAYOUT_STATUS } from '@/app/helpers/statusLabels';

/** The status filter's value for "no status filter". */
export const ALL_STATUSES = 'all';

/** Status filter options: "All" first, then every payout status of the contract (i18n keys). */
export const STATUS_FILTER_OPTIONS: readonly { value: string; labelKey: string }[] = [
  { value: ALL_STATUSES, labelKey: 'payouts.filters.all' },
  ...PAYOUT_STATUSES.map((status) => ({ value: status, labelKey: PAYOUT_STATUS[status].labelKey })),
];
