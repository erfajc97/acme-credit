import { Skeleton } from '@acme/ui';

interface PageSkeletonProps {
  /** Announced to screen readers while the page loads, e.g. "Loading accounts". */
  label: string;
  /** The shape of what is coming: KPI tiles, a dense list, or an account's detail. */
  variant?: 'dashboard' | 'list' | 'detail';
}

const LIST_ROWS = ['a', 'b', 'c', 'd', 'e', 'f'];
const TILES = ['a', 'b', 'c', 'd', 'e', 'f'];

/**
 * The loading shape of a console page. Rendered statically by the .astro page as the client:only
 * fallback (zero JS, WA2) and by the islands while their data loads (W13), so both match.
 */
export function PageSkeleton({ label, variant = 'list' }: PageSkeletonProps) {
  return (
    <div role="status" aria-live="polite" className="flex animate-reveal-late flex-col gap-4">
      <span className="sr-only">{label}</span>
      {variant === 'dashboard' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TILES.map((tile) => (
            <div
              key={tile}
              className="flex flex-col gap-2 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised"
            >
              <Skeleton className="h-4 w-28 rounded-control" />
              <Skeleton className="h-7 w-36 rounded-control" />
            </div>
          ))}
        </div>
      )}
      {variant === 'detail' && (
        <div className="flex flex-col gap-3 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-raised">
          <Skeleton className="h-6 w-48 rounded-control" />
          <Skeleton className="h-4 w-64 max-w-full rounded-control" />
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      )}
      <div className="flex flex-col rounded-card border-[1.6px] border-ink bg-surface-raised px-4 py-2 shadow-raised">
        {LIST_ROWS.map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40 rounded-control" />
            <Skeleton className="h-4 w-20 rounded-control" />
          </div>
        ))}
      </div>
    </div>
  );
}
