import { layoutTour, TOUR_MARGIN, type TourLayout } from './tourLayout';

/** The card's size before it is measured (the desktop width, a typical height). */
const CARD_FALLBACK = { width: 416, height: 220 };
/** Room above the section once it is scrolled into view. */
const SCROLL_OFFSET = TOUR_MARGIN * 2;

interface WatchOptions {
  /** The section the step talks about (`[data-tour="…"]`). */
  selector: string;
  /** The tour card, measured so the layout leaves room for it; null until it mounts. */
  card: HTMLElement | null;
  /** The new layout, or null while the section is not on the page (loading, navigating). */
  onLayout: (layout: TourLayout | null) => void;
}

function scrollToTarget(target: Element): void {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

/**
 * Follows the section a tour step spotlights: waits until it is on the page (the step may have
 * just navigated, or the island is still loading its data), scrolls it to the top of the screen
 * once, then recomputes the cut-out and the card's place on every scroll, resize, size change of
 * the section or the card, and change of the page (ClientRouter swaps, rows arriving), at most
 * once per frame. Returns the cleanup.
 */
export function watchTarget({ selector, card, onLayout }: WatchOptions): () => void {
  let target: Element | null = null;
  let frame = 0;
  const sizes = new ResizeObserver(() => schedule());

  function measure(): void {
    frame = 0;
    if (target && !target.isConnected) target = null;
    if (!target) {
      target = document.querySelector(selector);
      if (!target) return onLayout(null);
      sizes.observe(target);
      scrollToTarget(target);
    }
    const box = target.getBoundingClientRect();
    onLayout(
      layoutTour({
        target: { top: box.top, left: box.left, width: box.width, height: box.height },
        card: card ? { width: card.offsetWidth, height: card.offsetHeight } : CARD_FALLBACK,
        viewport: {
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
        },
      }),
    );
  }

  function schedule(): void {
    if (frame === 0) frame = window.requestAnimationFrame(measure);
  }

  const changes = new MutationObserver(schedule);
  // The document element survives ClientRouter swaps (the body does not).
  changes.observe(document.documentElement, { childList: true, subtree: true });
  if (card) sizes.observe(card);
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule);
  measure();

  return () => {
    window.cancelAnimationFrame(frame);
    changes.disconnect();
    sizes.disconnect();
    window.removeEventListener('scroll', schedule, { capture: true });
    window.removeEventListener('resize', schedule);
  };
}
