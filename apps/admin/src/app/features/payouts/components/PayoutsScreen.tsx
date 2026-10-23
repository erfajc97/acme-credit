import { AppButton, Panel, SegmentedFilter } from '@acme/ui';
import { ListSearch } from '@/app/components/ListSearch';
import { ListStates } from '@/app/components/ListStates';
import { PayoutsTable } from '@/app/components/PayoutsTable';
import { t } from '@/app/i18n';
import { usePayoutsList } from '../hooks/usePayoutsList';

export function PayoutsScreen() {
  const payouts = usePayoutsList();
  return (
    <div data-tour="payouts" className="flex flex-col gap-3 sm:gap-5">
      <ListSearch
        name="q"
        label={t('search.payouts.label')}
        placeholder={t('search.payouts.placeholder')}
        urlText={payouts.searchText}
        onSearch={payouts.search}
      />
      <SegmentedFilter
        label={t('payouts.filters.status')}
        options={payouts.statusOptions}
        value={payouts.statusValue}
        onChange={payouts.setStatus}
        scroll={{
          previousLabel: t('payouts.filters.previous'),
          nextLabel: t('payouts.filters.next'),
        }}
      />
      <Panel density="compact">
        <ListStates
          listName={t('nav.payouts')}
          view={payouts.list}
          loadingLabel={t('payouts.loading')}
          errorTitle={t('payouts.loadFailedTitle')}
          errorBody={t('payouts.loadFailedBody')}
          emptyTitle={payouts.empty.title}
          emptyBody={payouts.empty.body}
          emptyAction={
            payouts.empty.canShowAll && (
              <AppButton
                variant="secondary"
                size="compact"
                onPress={payouts.isSearched ? payouts.clearSearch : payouts.showAll}
              >
                {payouts.isSearched ? t('search.clearAction') : t('payouts.showAll')}
              </AppButton>
            )
          }
        >
          {(rows) => <PayoutsTable caption={t('payouts.tableCaption')} rows={rows} showCustomer />}
        </ListStates>
      </Panel>
    </div>
  );
}
