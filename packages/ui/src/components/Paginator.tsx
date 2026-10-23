import { Button } from '@heroui/react';

/** A page number, or one of the two "…" gaps (distinct keys so React can tell them apart). */
export type PageItem = number | 'gap-start' | 'gap-end';

/** Up to this many pages are all listed; above it the row keeps exactly this many slots. */
const SLOTS = 7;

/**
 * The numbered row: first and last page always, the current page with one neighbour on each side,
 * "…" where pages are skipped (1 … 4 5 6 … 20). The row always has 7 slots once it collapses, so
 * the buttons do not jump around while the user pages.
 */
export function pageItems({ page, totalPages }: { page: number; totalPages: number }): PageItem[] {
  if (totalPages <= SLOTS) return Array.from({ length: totalPages }, (_, index) => index + 1);
  let start = page - 1;
  let end = page + 1;
  if (page <= 4) {
    start = 2;
    end = 5;
  } else if (page >= totalPages - 3) {
    start = totalPages - 4;
    end = totalPages - 1;
  }
  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return [
    1,
    ...(start > 2 ? (['gap-start'] as const) : []),
    ...middle,
    ...(end < totalPages - 1 ? (['gap-end'] as const) : []),
    totalPages,
  ];
}

export interface PaginatorLabels {
  /** Names the nav landmark, e.g. "Order pages" (several lists may share a screen). */
  nav: string;
  previous: string;
  next: string;
  /** Accessible name of a numbered button: "Page 4". */
  page: (page: number) => string;
  /** The compact phone row and a visible summary: "Page 4 of 20". */
  status: (page: number, totalPages: number) => string;
}

export interface PaginatorProps {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels: PaginatorLabels;
  /** Blocks the controls while the next page loads. */
  isDisabled?: boolean;
  /**
   * "compact" (back office): on phones the row hugs its content (it shares a line with the range
   * text) and the arrows lose their side padding; every target stays 44 px.
   */
  density?: 'regular' | 'compact';
}

const CONTROL = 'min-h-11 min-w-11 rounded-control px-3 font-semibold data-pressed:transform-none';

/**
 * Numbered pagination (W7, W9, W10): a labelled nav landmark; prev / next and numbered buttons with
 * "…" gaps from `md` up; on phones the compact row prev · "Page 4 of 20" · next. Every target is
 * 44 px. All copy comes in through `labels` (the package has no i18n of its own). Renders nothing
 * when there is a single page.
 */
export function Paginator({
  page,
  totalPages,
  onPageChange,
  labels,
  isDisabled = false,
  density = 'regular',
}: PaginatorProps) {
  if (totalPages <= 1) return null;
  const isCompact = density === 'compact';
  const arrow = `${CONTROL} ${isCompact ? 'max-md:px-0' : ''} border-[1.6px] border-border-strong bg-surface-raised text-fg`;
  const go = (target: number) => {
    if (target !== page) onPageChange(target);
  };
  return (
    <nav
      aria-label={labels.nav}
      className={`flex items-center gap-2 md:justify-center ${isCompact ? 'max-md:gap-1' : 'justify-between'}`}
    >
      <Button
        variant="secondary"
        size="lg"
        className={arrow}
        isDisabled={isDisabled || page <= 1}
        onPress={() => go(page - 1)}
      >
        <span aria-hidden="true">‹</span>
        <span className="sr-only md:not-sr-only">{labels.previous}</span>
      </Button>
      <p
        className={`font-medium text-muted md:hidden ${isCompact ? 'text-caption' : 'text-small'}`}
        aria-live="polite"
      >
        {labels.status(page, totalPages)}
      </p>
      <ol className="hidden items-center gap-1 md:flex">
        {pageItems({ page, totalPages }).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <Button
                variant={item === page ? 'primary' : 'ghost'}
                size="lg"
                // The current page is the yellow pill: its text is the on-brand ink in both themes.
                className={`${CONTROL} tabular-nums ${item === page ? 'text-on-brand' : 'text-fg'}`}
                aria-label={labels.page(item)}
                {...(item === page ? { 'aria-current': 'page' as const } : {})}
                isDisabled={isDisabled}
                onPress={() => go(item)}
              >
                {item}
              </Button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ),
        )}
      </ol>
      <Button
        variant="secondary"
        size="lg"
        className={arrow}
        isDisabled={isDisabled || page >= totalPages}
        onPress={() => go(page + 1)}
      >
        <span className="sr-only md:not-sr-only">{labels.next}</span>
        <span aria-hidden="true">›</span>
      </Button>
    </nav>
  );
}
