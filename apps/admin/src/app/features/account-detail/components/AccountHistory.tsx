import { AppButton, Panel } from '@acme/ui';
import { AuditTable } from '@/app/components/AuditTable';
import { JournalEntryList } from '@/app/components/JournalEntryList';
import { ListSearch } from '@/app/components/ListSearch';
import { ListStates } from '@/app/components/ListStates';
import { SectionTitle } from '@/app/components/SectionTitle';
import type { ReleaseTarget } from '@/app/helpers/holds';
import type { PurchaseDetailView } from '@/app/hooks/usePurchaseDetail';
import { t } from '@/app/i18n';
import type { AccountHistoryView, HistorySearchView } from '../hooks/useAccountHistory';
import { AuthorizationsTable } from './AuthorizationsTable';

/** Authorizations, journal entries and audit entries of one account, newest first. */
interface AccountHistoryProps {
  history: AccountHistoryView;
  onRelease: (target: ReleaseTarget) => void;
  /** Opens a purchase's detail sheet from its merchant. */
  detail: PurchaseDetailView;
}

/** A searched history that found nothing offers to drop the search. */
function clearSearchAction(search: HistorySearchView) {
  return (
    search.empty && (
      <AppButton variant="secondary" size="compact" onPress={search.clear}>
        {t('search.clearAction')}
      </AppButton>
    )
  );
}

export function AccountHistory({ history, onRelease, detail }: AccountHistoryProps) {
  const purchases = history.authorizationsSearch;
  const journal = history.journalSearch;
  return (
    <>
      <Panel labelledBy="authorizations-title" density="compact">
        <SectionTitle id="authorizations-title">
          {t('accountDetail.authorizations.title')}
        </SectionTitle>
        <ListSearch
          name="purchasesQ"
          label={t('search.accountPurchases.label')}
          placeholder={t('search.accountPurchases.placeholder')}
          urlText={purchases.text}
          onSearch={purchases.search}
        />
        <ListStates
          listName={t('accountDetail.authorizations.title')}
          view={history.authorizations}
          loadingLabel={t('accountDetail.loading')}
          errorTitle={t('accountDetail.authorizations.loadFailedTitle')}
          errorBody={t('accountDetail.loadFailedBody')}
          emptyTitle={purchases.empty?.title ?? t('accountDetail.authorizations.emptyTitle')}
          emptyBody={purchases.empty?.body ?? t('accountDetail.authorizations.emptyBody')}
          emptyAction={clearSearchAction(purchases)}
        >
          {(rows) => (
            <AuthorizationsTable
              rows={rows}
              onRelease={onRelease}
              detailHref={detail.hrefFor}
              onOpenDetail={detail.onLinkClick}
            />
          )}
        </ListStates>
      </Panel>
      <Panel labelledBy="journal-title" density="compact">
        <SectionTitle id="journal-title">{t('accountDetail.journal.title')}</SectionTitle>
        <ListSearch
          name="journalQ"
          label={t('search.accountLedger.label')}
          placeholder={t('search.accountLedger.placeholder')}
          urlText={journal.text}
          onSearch={journal.search}
        />
        <ListStates
          listName={t('accountDetail.journal.title')}
          view={history.journal}
          loadingLabel={t('accountDetail.loading')}
          errorTitle={t('accountDetail.journal.loadFailedTitle')}
          errorBody={t('accountDetail.loadFailedBody')}
          emptyTitle={journal.empty?.title ?? t('accountDetail.journal.emptyTitle')}
          emptyBody={journal.empty?.body ?? t('accountDetail.journal.emptyBody')}
          emptyAction={clearSearchAction(journal)}
        >
          {(rows) => <JournalEntryList entries={rows} />}
        </ListStates>
      </Panel>
      <Panel labelledBy="audit-title" density="compact">
        <SectionTitle id="audit-title">{t('accountDetail.audit.title')}</SectionTitle>
        <ListStates
          listName={t('accountDetail.audit.title')}
          view={history.audit}
          loadingLabel={t('accountDetail.loading')}
          errorTitle={t('accountDetail.audit.loadFailedTitle')}
          errorBody={t('accountDetail.loadFailedBody')}
          emptyTitle={t('accountDetail.audit.emptyTitle')}
          emptyBody={t('accountDetail.audit.emptyBody')}
        >
          {(rows) => <AuditTable rows={rows} />}
        </ListStates>
      </Panel>
    </>
  );
}
