import { AmountText, DataTable, ErrorState, Panel, StatusChip, type DataColumn } from '@acme/ui';
import { ArrowRight } from 'lucide-react';
import { RowsSkeleton } from '@/app/components/RowsSkeleton';
import { SectionTitle } from '@/app/components/SectionTitle';
import { Icon } from '@/app/components/UI/Icon';
import type { PurchaseRow } from '@/app/helpers/orders';
import { t } from '@/app/i18n';
import type { PurchasesView } from '../hooks/useDashboard';

/** Built at render time, in the page's locale. */
function recentColumns(): DataColumn<PurchaseRow>[] {
  return [
    {
      id: 'merchant',
      header: t('purchases.columns.merchant'),
      isPrimary: true,
      cell: (row) => <span className="font-semibold">{row.merchant}</span>,
    },
    {
      id: 'customer',
      header: t('purchases.columns.customer'),
      cell: (row) =>
        row.customer && row.accountHref ? (
          <a
            href={row.accountHref}
            className="font-semibold text-violet underline-offset-2 hover:underline"
          >
            {row.customer.name}
          </a>
        ) : (
          <span className="text-muted">{t('purchases.noCustomer')}</span>
        ),
    },
    {
      id: 'date',
      mobile: 'meta',
      header: t('purchases.columns.date'),
      cell: (row) => <time className="whitespace-nowrap">{row.time}</time>,
    },
    {
      id: 'status',
      mobile: 'meta',
      header: t('purchases.columns.status'),
      cell: (row) => <StatusChip tone={row.tone} label={t(row.statusKey)} />,
    },
    {
      id: 'amount',
      mobile: 'end',
      header: t('purchases.columns.amount'),
      align: 'end',
      cell: (row) => <AmountText value={row.amount} />,
    },
  ];
}

/** The newest purchases across the wallet: who, where, when, status in words and amount. */
export function RecentPurchases({ purchases }: { purchases: PurchasesView }) {
  let body;
  if (purchases.state.isLoading) body = <RowsSkeleton label={t('purchases.loading')} />;
  else if (purchases.state.isError) {
    body = (
      <ErrorState
        title={t('dashboard.recentPurchasesFailed')}
        body={t('purchases.loadFailedBody')}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={purchases.state.retry}
        isRetrying={purchases.state.isRetrying}
      />
    );
  } else if (purchases.isEmpty)
    body = <p className="text-small text-muted">{t('dashboard.recentPurchasesEmpty')}</p>;
  else {
    body = (
      <DataTable
        density="compact"
        caption={t('dashboard.recentPurchasesTitle')}
        columns={recentColumns()}
        rows={purchases.recent}
        getRowKey={(row) => row.id}
      />
    );
  }
  return (
    <Panel labelledBy="recent-purchases-title" density="compact">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle id="recent-purchases-title">
          {t('dashboard.recentPurchasesTitle')}
        </SectionTitle>
        <a
          href={purchases.allHref}
          className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-violet underline-offset-4 hover:underline"
        >
          {t('dashboard.viewAllPurchases')}
          <Icon icon={ArrowRight} size={16} />
        </a>
      </div>
      {body}
    </Panel>
  );
}
