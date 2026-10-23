import {
  AppButton,
  EmptyState,
  ErrorState,
  Paginator,
  PendingIndicator,
  type PaginatorLabels,
} from '@acme/ui';
import { useRef, type ReactNode } from 'react';
import type { PagedListView } from '@/app/hooks/usePagedList';
import { t } from '@/app/i18n';
import { RowsSkeleton } from './RowsSkeleton';

interface ListStatesProps<Row> {
  view: PagedListView<Row>;
  /** Names the list's page navigation (several lists share the account page). */
  listName: string;
  loadingLabel: string;
  errorTitle: string;
  errorBody: string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: ReactNode;
  children: (rows: Row[]) => ReactNode;
}

function paginatorLabels(listName: string): PaginatorLabels {
  return {
    nav: t('common.pagination.nav', { list: listName }),
    previous: t('common.pagination.previous'),
    next: t('common.pagination.next'),
    page: (page) => t('common.pagination.page', { page }),
    status: (page, total) => t('common.pagination.status', { page, total }),
  };
}

/**
 * Skeleton, error with retry, empty state, or one page of rows (W13) with "Showing 11–20 of 47"
 * announced politely and the numbered pages under it. While another page or filter loads, the
 * previous rows stay, dimmed and marked as updating, instead of a skeleton; after a page change
 * the top of the list comes into view and takes the focus, so the next row read is the first.
 */
export function ListStates<Row>({
  view,
  listName,
  loadingLabel,
  errorTitle,
  errorBody,
  emptyTitle,
  emptyBody,
  emptyAction,
  children,
}: ListStatesProps<Row>) {
  const top = useRef<HTMLDivElement>(null);
  if (view.isLoading) return <RowsSkeleton label={loadingLabel} />;
  if (view.isError) {
    return (
      <ErrorState
        title={errorTitle}
        body={errorBody}
        retryLabel={t('common.retry')}
        retryingLabel={t('common.retrying')}
        onRetry={view.retry}
        isRetrying={view.isRetrying}
      />
    );
  }
  if (view.isEmpty)
    return <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} headingLevel={3} />;
  const changePage = (page: number) => {
    view.setPage(page);
    top.current?.focus({ preventScroll: true });
    top.current?.scrollIntoView({ block: 'start' });
  };
  return (
    <div
      ref={top}
      tabIndex={-1}
      className="flex scroll-mt-16 flex-col gap-2 rounded-card outline-none sm:gap-3 lg:scroll-mt-4"
      aria-busy={view.isUpdating}
    >
      {view.isUpdating && <PendingIndicator label={t('common.updating')} />}
      <div className={`transition-opacity duration-fast ${view.isUpdating ? 'opacity-60' : ''}`}>
        {children(view.rows)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 sm:gap-3 sm:pt-3">
        <p
          role="status"
          aria-live="polite"
          className={`text-caption sm:text-small ${view.isOutOfRange ? 'text-warning' : 'text-muted'}`}
        >
          {view.rangeMessage}
        </p>
        {view.isOutOfRange && (
          <AppButton variant="secondary" size="compact" onPress={() => changePage(view.totalPages)}>
            {t('common.goToLastPage')}
          </AppButton>
        )}
        <Paginator
          page={view.page}
          totalPages={view.totalPages}
          onPageChange={changePage}
          labels={paginatorLabels(listName)}
          isDisabled={view.isUpdating}
          density="compact"
        />
      </div>
    </div>
  );
}
