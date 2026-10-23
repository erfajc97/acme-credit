import { AppButton, Panel } from '@acme/ui';
import { JournalEntryList } from '@/app/components/JournalEntryList';
import { ListSearch } from '@/app/components/ListSearch';
import { ListStates } from '@/app/components/ListStates';
import { t } from '@/app/i18n';
import { useLedgerPage } from '../hooks/useLedgerPage';
import { TrialBalance } from './TrialBalance';

export function LedgerScreen() {
  const ledger = useLedgerPage();
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <TrialBalance view={ledger.trialBalance} isUnavailable={ledger.isTrialBalanceUnavailable} />
      <ListSearch
        name="q"
        label={t('search.ledger.label')}
        placeholder={t('search.ledger.placeholder')}
        urlText={ledger.searchText}
        onSearch={ledger.search}
      />
      <Panel density="compact">
        <ListStates
          listName={t('nav.ledger')}
          view={ledger.entries}
          loadingLabel={t('ledger.loading')}
          errorTitle={t('ledger.loadFailedTitle')}
          errorBody={t('ledger.loadFailedBody')}
          emptyTitle={ledger.empty.title}
          emptyBody={ledger.empty.body}
          emptyAction={
            ledger.isSearched && (
              <AppButton variant="secondary" size="compact" onPress={ledger.clearSearch}>
                {t('search.clearAction')}
              </AppButton>
            )
          }
        >
          {(rows) => <JournalEntryList entries={rows} showAccount />}
        </ListStates>
      </Panel>
    </div>
  );
}
