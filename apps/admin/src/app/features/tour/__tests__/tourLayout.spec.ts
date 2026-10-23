import { layoutTour, TOUR_GAP, TOUR_MARGIN } from '../helpers/tourLayout';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const CARD = { width: 416, height: 220 };

describe('layoutTour (cut-out around the section, card anchored beside it)', () => {
  it('desktop, a section that fits: the cut-out is the section padded, the card right under it', () => {
    const layout = layoutTour({
      target: { top: 100, left: 300, width: 1000, height: 300 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(layout.spot).toEqual({ top: 92, left: 292, width: 1016, height: 316 });
    expect(layout.card).toEqual({ top: 92 + 316 + TOUR_GAP, left: 292, width: 416 });
    expect(layout.side).toBe('below');
  });

  it('desktop, room on the right: the card sits beside the section, aligned with its top', () => {
    const layout = layoutTour({
      target: { top: 120, left: 260, width: 500, height: 500 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(layout.side).toBe('right');
    expect(layout.card).toEqual({ top: 112, left: 260 + 500 + 8 + TOUR_GAP, width: 416 });
  });

  it('a section taller than the screen: the cut-out keeps its top and leaves room for the card', () => {
    const layout = layoutTour({
      target: { top: 16, left: 16, width: 358, height: 2400 },
      card: { width: 366, height: 260 },
      viewport: PHONE,
    });
    const spotBottom = layout.spot.top + layout.spot.height;
    expect(layout.spot.top).toBe(8);
    expect(spotBottom + TOUR_GAP + 260).toBeLessThanOrEqual(PHONE.height - TOUR_MARGIN);
    expect(layout.side).toBe('below');
  });

  it('phone: the card spans the screen minus the margins (never wider than 390)', () => {
    const layout = layoutTour({
      target: { top: 200, left: 16, width: 358, height: 300 },
      card: { width: 366, height: 240 },
      viewport: PHONE,
    });
    expect(layout.card.left).toBe(TOUR_MARGIN);
    expect(layout.card.width).toBe(PHONE.width - 2 * TOUR_MARGIN);
  });

  it('a section near the bottom: the card goes above it', () => {
    const layout = layoutTour({
      target: { top: 600, left: 300, width: 1000, height: 200 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(layout.side).toBe('above');
    expect(layout.card.top).toBe(592 - TOUR_GAP - CARD.height);
  });

  it('a section scrolled partly out of view is cut to the visible part', () => {
    const layout = layoutTour({
      target: { top: -100, left: 300, width: 1000, height: 300 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(layout.spot.top).toBe(0);
    expect(layout.spot.height).toBe(208);
  });

  it('the card never leaves the screen on the right', () => {
    const layout = layoutTour({
      target: { top: 100, left: 1200, width: 200, height: 100 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(layout.card.left + layout.card.width).toBeLessThanOrEqual(DESKTOP.width - TOUR_MARGIN);
  });
});

describe('layoutTour rounding', () => {
  it('snaps the cut-out to whole pixels (no hairline seams between the dimmed panels)', () => {
    const layout = layoutTour({
      target: { top: 100.4, left: 300.6, width: 999.3, height: 299.7 },
      card: CARD,
      viewport: DESKTOP,
    });
    expect(layout.spot).toEqual({ top: 92, left: 293, width: 1015, height: 316 });
  });
});

describe('layoutTour: a section that leaves too little room below on screen', () => {
  it('cuts the section so the card never covers it', () => {
    const layout = layoutTour({
      target: { top: 16, left: 16, width: 358, height: 650 },
      card: { width: 366, height: 260 },
      viewport: PHONE,
    });
    expect(layout.spot.top + layout.spot.height + TOUR_GAP).toBeLessThanOrEqual(layout.card.top);
  });
});
