import {
  POPOVER_GAP,
  SHEET_BELOW_WIDTH,
  SIDE_ORDER,
  SPOTLIGHT_PADDING,
  VIEWPORT_MARGIN,
} from '../data';
import type {
  PopoverPlacement,
  PopoverSide,
  Rect,
  SheetEdge,
  Size,
  TourArrangement,
  TourLayout,
  TourMeasurement,
} from '../types';

/**
 * Pure positioning of the tour: the spotlight cutout and where the popover goes. Every rectangle
 * is in viewport coordinates (the overlay is `position: fixed`).
 */

/**
 * Whether a target is laid out on screen horizontally: drawn and not pushed out sideways (the
 * hidden sidebar on phones measures 0). Below the fold counts: it is scrolled into view.
 */
export function isRectDisplayed(rect: Rect, viewport: Size): boolean {
  return (
    rect.width > 0 && rect.height > 0 && rect.left + rect.width > 0 && rect.left < viewport.width
  );
}

/** The cutout: the target grown by `padding` on every side, kept inside the viewport. */
export function spotlightFor(target: Rect, padding: number, viewport: Size): Rect {
  const left = Math.max(0, target.left - padding);
  const top = Math.max(0, target.top - padding);
  const right = Math.min(viewport.width, target.left + target.width + padding);
  const bottom = Math.min(viewport.height, target.top + target.height + padding);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** A step without a target: the cutout is a point in the middle, so the whole page is dimmed. */
function closedSpotlight(viewport: Size): Rect {
  return { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0 };
}

/** `value` within [min, max]; an empty range (popover wider than the room) gives `min`. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

interface PlacementOptions {
  gap: number;
  margin: number;
  sides: readonly PopoverSide[];
}

interface SideInput {
  target: Rect;
  popover: Size;
  viewport: Size;
  gap: number;
  margin: number;
}

function fitsOn(side: PopoverSide, { target, popover, viewport, gap, margin }: SideInput): boolean {
  switch (side) {
    case 'right':
      return target.left + target.width + gap + popover.width <= viewport.width - margin;
    case 'left':
      return target.left - gap - popover.width >= margin;
    case 'bottom':
      return target.top + target.height + gap + popover.height <= viewport.height - margin;
    case 'top':
      return target.top - gap - popover.height >= margin;
  }
}

function positionOn(
  side: PopoverSide,
  { target, popover, viewport, gap, margin }: SideInput,
): PopoverPlacement {
  const top = clamp(
    target.top + target.height / 2 - popover.height / 2,
    margin,
    viewport.height - popover.height - margin,
  );
  const left = clamp(
    target.left + target.width / 2 - popover.width / 2,
    margin,
    viewport.width - popover.width - margin,
  );
  switch (side) {
    case 'right':
      return { side, top, left: target.left + target.width + gap };
    case 'left':
      return { side, top, left: target.left - gap - popover.width };
    case 'bottom':
      return { side, left, top: target.top + target.height + gap };
    case 'top':
      return { side, left, top: target.top - gap - popover.height };
  }
}

/**
 * The popover next to `target`: on the first of `sides` with room, centred along that side and
 * nudged to stay `margin` inside the viewport. No side has room: null (the caller centres it).
 */
export function placePopover(
  target: Rect,
  popover: Size,
  viewport: Size,
  { gap, margin, sides }: PlacementOptions,
): PopoverPlacement | null {
  const input = { target, popover, viewport, gap, margin };
  const side = sides.find((candidate) => fitsOn(candidate, input));
  return side ? positionOn(side, input) : null;
}

/** The popover in the middle of the viewport (intro, end, or a target with no room around it). */
export function centerPopover(popover: Size, viewport: Size): PopoverPlacement {
  return {
    side: 'center',
    top: Math.max(0, (viewport.height - popover.height) / 2),
    left: Math.max(0, (viewport.width - popover.width) / 2),
  };
}

export function layoutForWidth(viewportWidth: number, sheetBelowWidth: number): TourLayout {
  return viewportWidth < sheetBelowWidth ? 'sheet' : 'floating';
}

/** The phone sheet rests at the bottom, or at the top when its target is in the lower half. */
export function sheetEdgeFor(target: Rect | null, viewport: Size): SheetEdge {
  if (!target) return 'bottom';
  return target.top + target.height / 2 > viewport.height / 2 ? 'top' : 'bottom';
}

/** One step's arrangement: layout, cutout, and the popover beside it (or centred). */
export function arrangeTour({ viewport, target, popover }: TourMeasurement): TourArrangement {
  const layout = layoutForWidth(viewport.width, SHEET_BELOW_WIDTH);
  const spotlight = target
    ? spotlightFor(target, SPOTLIGHT_PADDING, viewport)
    : closedSpotlight(viewport);
  if (layout === 'sheet') {
    return { layout, spotlight, placement: null, sheetEdge: sheetEdgeFor(target, viewport) };
  }
  const placement = target
    ? placePopover(spotlight, popover, viewport, {
        gap: POPOVER_GAP,
        margin: VIEWPORT_MARGIN,
        sides: SIDE_ORDER,
      })
    : null;
  return {
    layout,
    spotlight,
    placement: placement ?? centerPopover(popover, viewport),
    sheetEdge: 'bottom',
  };
}
