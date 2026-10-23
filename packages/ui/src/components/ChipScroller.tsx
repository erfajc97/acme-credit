import { Button } from '@heroui/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FINE_POINTER_QUERY, useMediaQuery } from '../fit-layout';
import { ChevronIcon } from '../icons/ChevronIcon';
import { overflowEdges, scrollStep } from './chipScroll';

export interface ChipScrollerProps {
  children: ReactNode;
  /** Names the arrow that scrolls back (e.g. "Previous filters"). */
  previousLabel: string;
  /** Names the arrow that scrolls on (e.g. "More filters"). */
  nextLabel: string;
}

const ARROW =
  'absolute top-1/2 z-10 size-9 min-w-9 -translate-y-1/2 rounded-control border-[1.6px] border-ink bg-surface-raised p-0 text-fg data-hovered:bg-brand-500 data-hovered:text-on-brand data-pressed:scale-95';

/** Keeps the start/end overflow of a sideways row in state, re-measured on scroll and resize. */
function useOverflowEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const box = ref.current;
    if (!box) return;
    const next = overflowEdges(box);
    setEdges((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  }, []);
  // Syncs with the DOM (scroll position and box size), which React does not own: an effect is
  // the only place to listen to it (W3). No network involved.
  useEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    measure();
    box.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(box);
    if (box.firstElementChild) observer?.observe(box.firstElementChild);
    return () => {
      box.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure]);
  const page = (direction: 1 | -1) =>
    ref.current?.scrollBy({ left: direction * scrollStep(ref.current.clientWidth) });
  return { ref, edges, page };
}

/**
 * One row of chips that scrolls sideways (touch, trackpad, keyboard through the chips) without a
 * visible scrollbar. The side that hides chips fades out, so a cut chip reads as "more this way";
 * each chip is a snap point. With a mouse or trackpad, small round arrows on the overflowing sides
 * page the row. They stay out of the tab order: keyboard users move through the chips, and the
 * focused chip scrolls into view (scroll padding keeps it clear of the fade).
 */
export function ChipScroller({ children, previousLabel, nextLabel }: ChipScrollerProps) {
  const { ref, edges, page } = useOverflowEdges();
  const hasMouse = useMediaQuery(FINE_POINTER_QUERY);
  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={ref}
        data-overflow-start={edges.start || undefined}
        data-overflow-end={edges.end || undefined}
        className="chip-scroller flex snap-x snap-mandatory scroll-px-10 overflow-x-auto overscroll-x-contain px-4 py-1 motion-safe:scroll-smooth sm:px-0.5"
      >
        {children}
      </div>
      {hasMouse && edges.start && (
        <Button
          isIconOnly
          aria-label={previousLabel}
          excludeFromTabOrder
          onPress={() => page(-1)}
          className={`${ARROW} left-0`}
        >
          <ChevronIcon direction="start" className="size-4" />
        </Button>
      )}
      {hasMouse && edges.end && (
        <Button
          isIconOnly
          aria-label={nextLabel}
          excludeFromTabOrder
          onPress={() => page(1)}
          className={`${ARROW} right-0`}
        >
          <ChevronIcon direction="end" className="size-4" />
        </Button>
      )}
    </div>
  );
}
