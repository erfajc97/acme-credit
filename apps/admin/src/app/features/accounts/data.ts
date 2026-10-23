import { ACCOUNT_STATUSES } from '@acme/contracts';
import { ACCOUNT_STATUS } from '@/app/helpers/statusLabels';

/** The status filter's value for "no status filter". */
export const ALL_STATUSES = 'all';

/** Status filter options: "All" first, then every status of the contract, as i18n keys. */
export const STATUS_FILTER_OPTIONS: readonly { value: string; labelKey: string }[] = [
  { value: ALL_STATUSES, labelKey: 'accounts.filters.all' },
  ...ACCOUNT_STATUSES.map((status) => ({
    value: status,
    labelKey: ACCOUNT_STATUS[status].labelKey,
  })),
];
