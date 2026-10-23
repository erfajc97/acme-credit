import { AppButton, Panel, SegmentedFilter } from '@acme/ui';
import { ListSearch } from '@/app/components/ListSearch';
import { ListStates } from '@/app/components/ListStates';
import { t } from '@/app/i18n';
import { useAccountsList } from '../hooks/useAccountsList';
import { AccountsTable } from './AccountsTable';

export function AccountsScreen() {
  const accounts = useAccountsList();
  return (
    <div data-tour="accounts" className="flex flex-col gap-3 sm:gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <SegmentedFilter
          label={t('accounts.filters.status')}
          options={accounts.statusOptions}
          value={accounts.statusValue}
          onChange={accounts.setStatus}
        />
        <div className="lg:w-96">
          <ListSearch
            name="q"
            label={t('search.accounts.label')}
            placeholder={t('search.accounts.placeholder')}
            urlText={accounts.searchText}
            onSearch={accounts.search}
          />
        </div>
      </div>
      <Panel density="compact">
        <ListStates
          listName={t('nav.accounts')}
          view={accounts.list}
          loadingLabel={t('accounts.loading')}
          errorTitle={t('accounts.loadFailedTitle')}
          errorBody={t('accounts.loadFailedBody')}
          emptyTitle={accounts.empty.title}
          emptyBody={accounts.empty.body}
          emptyAction={
            accounts.empty.canClear && (
              <AppButton
                variant="secondary"
                size="compact"
                onPress={accounts.isSearched ? accounts.clearSearch : accounts.clearFilters}
              >
                {accounts.isSearched ? t('search.clearAction') : t('accounts.clearFilters')}
              </AppButton>
            )
          }
        >
          {(rows) => <AccountsTable rows={rows} />}
        </ListStates>
      </Panel>
    </div>
  );
}
