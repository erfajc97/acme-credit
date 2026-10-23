/** Room left between the cut-out and the card. */
export const TOUR_GAP = 16;
/** The card never comes closer than this to the screen's edges. */
export const TOUR_MARGIN = 12;
/** The cut-out breathes this much around the section. */
const SPOT_PADDING = 8;
/** Below this width (Tailwind `sm`) the card spans the screen. */
const PHONE_MAX = 640;
/** A cut-out cut down for the card still shows at least this much of the section. */
const MIN_SPOT = 96;

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourLayout {
  /** The lit hole in the dimmed page, in viewport pixels. */
  spot: Box;
  card: { top: number; left: number; width: number };
  side: 'right' | 'below' | 'above';
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where the spotlight and its card go for a section on screen (all in viewport pixels): the
 * cut-out is the visible part of the section, padded; the card sits on its right when there is
 * room (wide screens), else under it, else over it; a section taller than what is left is cut so
 * the card still fits under it. Phones get a card as wide as the screen minus the margins.
 */
export function layoutTour({
  target,
  card,
  viewport,
}: {
  target: Box;
  card: { width: number; height: number };
  viewport: { width: number; height: number };
}): TourLayout {
  const isPhone = viewport.width < PHONE_MAX;
  const cardWidth = isPhone
    ? viewport.width - 2 * TOUR_MARGIN
    : Math.min(card.width, viewport.width - 2 * TOUR_MARGIN);
  // Whole pixels: the four dimmed panels meet the cut-out without hairline seams.
  const top = Math.round(Math.max(target.top - SPOT_PADDING, 0));
  const left = Math.round(Math.max(target.left - SPOT_PADDING, 0));
  const right = Math.round(Math.min(target.left + target.width + SPOT_PADDING, viewport.width));
  let bottom = Math.round(Math.min(target.top + target.height + SPOT_PADDING, viewport.height));
  const spotOf = () => ({ top, left, width: right - left, height: bottom - top });
  const cardTopMax = viewport.height - card.height - TOUR_MARGIN;
  const cardLeft = isPhone
    ? TOUR_MARGIN
    : clamp(left, TOUR_MARGIN, viewport.width - cardWidth - TOUR_MARGIN);

  if (!isPhone && viewport.width - right >= cardWidth + TOUR_GAP + TOUR_MARGIN) {
    return {
      spot: spotOf(),
      card: { top: clamp(top, TOUR_MARGIN, cardTopMax), left: right + TOUR_GAP, width: cardWidth },
      side: 'right',
    };
  }
  const roomBelow = viewport.height - bottom - TOUR_MARGIN;
  const roomAbove = top - TOUR_MARGIN;
  const needed = card.height + TOUR_GAP;
  if (roomBelow < needed && roomAbove >= needed) {
    return {
      spot: spotOf(),
      card: { top: top - TOUR_GAP - card.height, left: cardLeft, width: cardWidth },
      side: 'above',
    };
  }
  if (roomBelow < needed) bottom = Math.max(cardTopMax - TOUR_GAP, top + MIN_SPOT);
  return {
    spot: spotOf(),
    card: { top: Math.min(bottom + TOUR_GAP, cardTopMax), left: cardLeft, width: cardWidth },
    side: 'below',
  };
}
