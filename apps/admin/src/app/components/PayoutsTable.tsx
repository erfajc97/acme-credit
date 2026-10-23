import { AmountText, DataTable, StatusChip, type DataColumn } from '@acme/ui';
import type { PayoutRow } from '@/app/helpers/payouts';
import { t } from '@/app/i18n';

const none = () => <span className="text-muted">{t('common.none')}</span>;

/** Built at render time, in the page's locale; the customer column only across accounts. */
function payoutColumns(showCustomer: boolean): DataColumn<PayoutRow>[] {
  const customer: DataColumn<PayoutRow> = {
    id: 'customer',
    header: t('payouts.columns.customer'),
    isPrimary: true,
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <a
          href={row.accountHref}
          className="font-semibold text-violet underline-offset-2 hover:underline"
        >
          {row.customer?.name ?? t('payouts.openAccount')}
        </a>
        {row.customer && (
          <span className="text-caption break-all text-muted">{row.customer.email}</span>
        )}
      </span>
    ),
  };
  const columns: DataColumn<PayoutRow>[] = [
    {
      id: 'reason',
      mobile: 'meta',
      header: t('payouts.columns.reason'),
      isPrimary: !showCustomer,
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{t(row.reasonKey)}</span>
          <time className="text-caption whitespace-nowrap text-muted">{row.created}</time>
        </span>
      ),
    },
    {
      id: 'status',
      mobile: 'meta',
      header: t('payouts.columns.status'),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={row.tone} label={t(row.statusKey)} />
          {row.outcome && (
            <span className="text-caption text-muted">
              {t(row.outcome.labelKey, { time: row.outcome.time })}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'attempts',
      header: t('payouts.columns.attempts'),
      align: 'end',
      cell: (row) => <span className="font-mono tabular-nums">{row.attempts}</span>,
    },
    {
      id: 'lastError',
      header: t('payouts.columns.lastError'),
      cell: (row) =>
        row.lastError ? (
          <code className="font-mono text-caption break-all text-danger">{row.lastError}</code>
        ) : (
          none()
        ),
    },
    {
      id: 'reference',
      header: t('payouts.columns.reference'),
      cell: (row) =>
        row.reference ? (
          <code className="font-mono text-caption break-all">{row.reference}</code>
        ) : (
          none()
        ),
    },
    {
      id: 'amount',
      mobile: 'end',
      header: t('payouts.columns.amount'),
      align: 'end',
      cell: (row) => <AmountText value={row.amount} />,
    },
  ];
  return showCustomer ? [customer, ...columns] : columns;
}

interface PayoutsTableProps {
  caption: string;
  rows: PayoutRow[];
  showCustomer: boolean;
}

/** Payouts as a dense table on desktop and as cards on phones (W9). */
export function PayoutsTable({ caption, rows, showCustomer }: PayoutsTableProps) {
  return (
    <DataTable
      density="compact"
      caption={caption}
      columns={payoutColumns(showCustomer)}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );
}
