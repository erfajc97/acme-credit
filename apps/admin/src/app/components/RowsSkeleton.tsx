import { Skeleton } from '@acme/ui';

const ROWS = ['a', 'b', 'c', 'd', 'e'];

/**
 * Loading rows for a list that already sits inside its section card (W13): no second frame, so
 * cards never nest. The label is announced; the blocks are decorative.
 */
export function RowsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex animate-reveal-late flex-col">
      <span className="sr-only">{label}</span>
      {ROWS.map((row) => (
        <div
          key={row}
          className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-40 rounded-control" />
          <Skeleton className="h-4 w-20 rounded-control" />
        </div>
      ))}
    </div>
  );
}
