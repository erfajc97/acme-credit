import { AppButton, Panel, SegmentedFilter } from '@acme/ui';
import { ListSearch } from '@/app/components/ListSearch';
import { ListStates } from '@/app/components/ListStates';
import { PurchaseDetailSheet } from '@/app/components/PurchaseDetailSheet';
import { ReleaseHoldDialog } from '@/app/components/ReleaseHoldDialog';
import { t } from '@/app/i18n';
import { usePurchasesList } from '../hooks/usePurchasesList';
import { PurchasesTable } from './PurchasesTable';

export function PurchasesScreen() {
  const purchases = usePurchasesList();
  return (
    <div data-tour="purchases" className="flex flex-col gap-3 sm:gap-5">
      <ListSearch
        name="q"
        label={t('search.purchases.label')}
        placeholder={t('search.purchases.placeholder')}
        urlText={purchases.searchText}
        onSearch={purchases.search}
      />
      <SegmentedFilter
        label={t('purchases.filters.status')}
        options={purchases.statusOptions}
        value={purchases.statusValue}
        onChange={purchases.setStatus}
        scroll={{
          previousLabel: t('purchases.filters.previous'),
          nextLabel: t('purchases.filters.next'),
        }}
      />
      <Panel density="compact">
        <ListStates
          listName={t('nav.purchases')}
          view={purchases.list}
          loadingLabel={t('purchases.loading')}
          errorTitle={t('purchases.loadFailedTitle')}
          errorBody={t('purchases.loadFailedBody')}
          emptyTitle={purchases.empty.title}
          emptyBody={purchases.empty.body}
          emptyAction={
            purchases.empty.canShowAll && (
              <AppButton
                variant="secondary"
                size="compact"
                onPress={purchases.isSearched ? purchases.clearSearch : purchases.showAll}
              >
                {purchases.isSearched ? t('search.clearAction') : t('purchases.showAll')}
              </AppButton>
            )
          }
        >
          {(rows) => (
            <PurchasesTable
              rows={rows}
              onRelease={purchases.release.open}
              detailHref={purchases.detail.hrefFor}
              onOpenDetail={purchases.detail.onLinkClick}
            />
          )}
        </ListStates>
      </Panel>
      <ReleaseHoldDialog release={purchases.release} />
      <PurchaseDetailSheet view={purchases.detail} />
    </div>
  );
}
