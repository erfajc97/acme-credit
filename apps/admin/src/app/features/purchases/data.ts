import { AUTHORIZATION_STATUSES } from '@acme/contracts';
import { AUTHORIZATION_STATUS } from '@/app/helpers/statusLabels';

/** The status filter's value for "no status filter". */
export const ALL_STATUSES = 'all';

/** Status filter options: "All" first, then every authorization status of the contract (i18n keys). */
export const STATUS_FILTER_OPTIONS: readonly { value: string; labelKey: string }[] = [
  { value: ALL_STATUSES, labelKey: 'purchases.filters.all' },
  ...AUTHORIZATION_STATUSES.map((status) => ({
    value: status,
    labelKey: AUTHORIZATION_STATUS[status].labelKey,
  })),
];
