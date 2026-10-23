/** Sub-pixel widths (zoom, fractional DPR) leave up to 1 px of "overflow" that hides nothing. */
const EDGE_TOLERANCE_PX = 1;
/** One arrow press pages by most of the visible row, keeping a chip of context. */
const PAGE_RATIO = 0.8;
/** ...but never less than about one chip, on a very narrow row. */
const MIN_STEP_PX = 120;

export interface ScrollBox {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/** Which sides of a sideways row hide chips (they get a fade and, with a mouse, an arrow). */
export function overflowEdges({ scrollLeft, clientWidth, scrollWidth }: ScrollBox): {
  start: boolean;
  end: boolean;
} {
  return {
    start: scrollLeft > EDGE_TOLERANCE_PX,
    end: scrollLeft + clientWidth < scrollWidth - EDGE_TOLERANCE_PX,
  };
}

/** How far one arrow press scrolls the row, in px. */
export function scrollStep(clientWidth: number): number {
  return Math.max(Math.round(clientWidth * PAGE_RATIO), MIN_STEP_PX);
}
