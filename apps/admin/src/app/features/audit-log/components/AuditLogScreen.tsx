import { AppButton, Panel } from '@acme/ui';
import { AuditTable } from '@/app/components/AuditTable';
import { ListSearch } from '@/app/components/ListSearch';
import { ListStates } from '@/app/components/ListStates';
import { t } from '@/app/i18n';
import { useAuditLogPage } from '../hooks/useAuditLogPage';
import { AuditFilterForm } from './AuditFilterForm';

export function AuditLogScreen() {
  const page = useAuditLogPage();
  return (
    <div data-tour="auditLog" className="flex flex-col gap-3 sm:gap-5">
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <ListSearch
          name="q"
          label={t('search.auditLog.label')}
          placeholder={t('search.auditLog.placeholder')}
          urlText={page.searchText}
          onSearch={page.search}
        />
        {/* Re-created when the URL's filter changes (Back/Forward), never synced by an effect. */}
        <AuditFilterForm
          key={page.entityId ?? ''}
          entityId={page.entityId}
          onApply={page.applyFilter}
          onClear={page.clearFilter}
        />
      </div>
      <Panel density="compact">
        <ListStates
          listName={t('nav.auditLog')}
          view={page.entries}
          loadingLabel={t('auditLog.loading')}
          errorTitle={t('auditLog.loadFailedTitle')}
          errorBody={t('auditLog.loadFailedBody')}
          emptyTitle={page.empty.title}
          emptyBody={page.empty.body}
          emptyAction={
            page.isSearched && (
              <AppButton variant="secondary" size="compact" onPress={page.clearSearch}>
                {t('search.clearAction')}
              </AppButton>
            )
          }
        >
          {(rows) => <AuditTable rows={rows} />}
        </ListStates>
      </Panel>
    </div>
  );
}
