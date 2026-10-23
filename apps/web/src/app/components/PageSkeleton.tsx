import { Skeleton } from '@acme/ui';

interface PageSkeletonProps {
  /** Announced to screen readers while the page loads, e.g. "Loading your wallet". */
  label: string;
}

/**
 * The loading shape of an app page: two columns from lg like the screens themselves. Rendered
 * statically by the .astro page as the client:only fallback (zero JS, WA2) and by the islands
 * while their data loads (W13).
 */
export function PageSkeleton({ label }: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8"
    >
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-6">
        <Skeleton className="aspect-[1.586] w-full max-w-sm rounded-card" />
        <div className="flex flex-col gap-3 rounded-card border-[1.6px] border-border bg-surface-raised p-5">
          <Skeleton className="h-4 w-32 rounded-control" />
          <Skeleton className="h-10 w-48 rounded-control" />
          <Skeleton className="h-4 w-full rounded-control" />
        </div>
      </div>
      <div className="hidden flex-col gap-3 rounded-card bg-neutral-soft p-5 lg:flex">
        <Skeleton className="h-6 w-40 rounded-control" />
        <Skeleton className="h-12 w-full rounded-control" />
        <Skeleton className="h-12 w-full rounded-control" />
      </div>
    </div>
  );
}
