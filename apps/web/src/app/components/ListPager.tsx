import { Paginator } from '@acme/ui';
import type { PagerView } from '@/app/hooks/useListPager';

/**
 * Under a list: "Showing 11–20 of 47" and the numbered pager (hidden while there is nothing to
 * count: loading, error or an empty list). It sits outside the list's scroll box, so on desktop it
 * stays in view while the rows scroll.
 */
export function ListPager({ pager }: { pager: PagerView }) {
  if (pager.summary === null && pager.totalPages <= 1) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {pager.summary && <p className="text-small text-muted tabular-nums">{pager.summary}</p>}
      <Paginator
        page={pager.page}
        totalPages={pager.totalPages}
        onPageChange={pager.onPageChange}
        labels={pager.labels}
        isDisabled={pager.isChanging}
      />
    </div>
  );
}
