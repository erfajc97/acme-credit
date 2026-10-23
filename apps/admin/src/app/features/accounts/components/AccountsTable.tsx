import { AmountText, DataTable, StatusChip, type DataColumn } from '@acme/ui';
import { t } from '@/app/i18n';
import type { AccountRow } from '../helpers/accountRows';

const amount = (
  id: string,
  header: string,
  pick: (row: AccountRow) => string,
): DataColumn<AccountRow> => ({
  id,
  header,
  align: 'end',
  cell: (row) => <AmountText value={pick(row)} />,
});

/** Built at render time, in the page's locale (a module constant would freeze one language). */
function accountColumns(): DataColumn<AccountRow>[] {
  return [
    {
      id: 'customer',
      header: t('accounts.columns.customer'),
      isPrimary: true,
      cell: (row) => (
        <a href={row.href} className="flex min-w-0 flex-col rounded-control hover:underline">
          <span className="truncate font-semibold text-violet">{row.name}</span>
          <span className="truncate text-caption text-muted">{row.email}</span>
          <span className="text-caption text-muted">
            {t('accountDetail.opened', { date: row.opened })}
          </span>
        </a>
      ),
    },
    {
      id: 'status',
      mobile: 'meta',
      header: t('accounts.columns.status'),
      cell: (row) => <StatusChip tone={row.tone} label={t(row.statusKey)} />,
    },
    amount('collateral', t('accounts.columns.collateral'), (row) => row.collateral),
    amount('limit', t('accounts.columns.limit'), (row) => row.limit),
    amount('held', t('accounts.columns.held'), (row) => row.held),
    amount('owed', t('accounts.columns.owed'), (row) => row.owed),
    amount('available', t('accounts.columns.available'), (row) => row.available),
    {
      id: 'card',
      mobile: 'meta',
      header: t('accounts.columns.card'),
      cell: (row) =>
        row.cardLast4 ? (
          <span className="font-mono whitespace-nowrap tabular-nums">
            {t('accounts.cardMasked', { last4: row.cardLast4 })}
          </span>
        ) : (
          <span className="text-muted">{t('accounts.noCard')}</span>
        ),
    },
  ];
}

/** Accounts as a dense table on desktop and as cards on phones; the customer opens the detail. */
export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  return (
    <DataTable
      density="compact"
      caption={t('accounts.tableCaption')}
      columns={accountColumns()}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );
}
