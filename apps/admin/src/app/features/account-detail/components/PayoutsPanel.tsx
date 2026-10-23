import { EmptyState, Panel } from '@acme/ui';
import { PayoutsTable } from '@/app/components/PayoutsTable';
import { SectionTitle } from '@/app/components/SectionTitle';
import type { PayoutRow } from '@/app/helpers/payouts';
import { t } from '@/app/i18n';

/** Money sent back to this customer (collateral, refunds): status, attempts, last error, reference. */
export function PayoutsPanel({ rows }: { rows: PayoutRow[] }) {
  return (
    <Panel labelledBy="payouts-title" density="compact">
      <SectionTitle id="payouts-title">{t('accountDetail.payouts.title')}</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState
          title={t('accountDetail.payouts.emptyTitle')}
          body={t('accountDetail.payouts.emptyBody')}
          headingLevel={3}
        />
      ) : (
        <PayoutsTable
          caption={t('accountDetail.payouts.caption')}
          rows={rows}
          showCustomer={false}
        />
      )}
    </Panel>
  );
}
