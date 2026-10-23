import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toAuditRow } from '@/app/helpers/audit';
import { AUDIT_LIST } from '@/app/helpers/listQuery';
import { searchEmptyState } from '@/app/helpers/listSearch';
import { usePagedList } from '@/app/hooks/usePagedList';
import { useListUrlState } from '@/app/hooks/useListUrlState';
import { t } from '@/app/i18n';
import { useAuditLogQuery } from '@/app/tanstack-queries/adminQueries';
import { auditFilterSchema, type AuditFilterInput, type AuditFilterValues } from '../schema';

/**
 * The audit trail, optionally narrowed to one entity and searched; the filter, the search and the
 * page live in the URL (W17). A new filter or search writes no page, so it starts at page 1.
 */
export function useAuditLogPage() {
  const { query, setQuery } = useListUrlState(AUDIT_LIST);
  const entityId = query.entityId ?? null;
  const entries = usePagedList(useAuditLogQuery(entityId, query), toAuditRow, {
    page: query.page ?? 1,
    setPage: (page: number) => setQuery({ ...query, page }),
  });
  return {
    entries,
    entityId,
    applyFilter: (value: string) => setQuery({ entityId: value, q: query.q }),
    clearFilter: () => setQuery({ q: query.q }),
    searchText: query.q ?? '',
    search: (text: string) => setQuery({ entityId: query.entityId, q: text || undefined }),
    clearSearch: () => setQuery({ entityId: query.entityId }),
    isSearched: query.q !== undefined,
    // A search says what found nothing; an entity filter says that entity has no history yet.
    empty:
      searchEmptyState(query.q) ??
      (entityId
        ? { title: t('auditLog.emptyFilteredTitle'), body: t('auditLog.emptyFilteredBody') }
        : { title: t('auditLog.emptyTitle'), body: t('auditLog.emptyBody') }),
  };
}

/** The filter box: validates like the API; re-created (key) when the URL's filter changes. */
export function useAuditFilterForm(initialEntityId: string, onApply: (value: string) => void) {
  const form = useForm<AuditFilterInput, unknown, AuditFilterValues>({
    resolver: zodResolver(auditFilterSchema),
    defaultValues: { entityId: initialEntityId },
  });
  return {
    control: form.control,
    onSubmit: form.handleSubmit((values) => onApply(values.entityId)),
  };
}
