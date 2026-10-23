import {
  clearPendingTour,
  hasPendingTour,
  requestTourAfterSignIn,
  TOUR_PENDING_KEY,
  TOUR_SKIP_KEY,
} from '@/app/helpers/tourTrigger';
import { SPOTLIGHT_PADDING } from '../data';
import { stepRouteToVisit } from '../helpers/stepRoute';
import {
  arrangeTour,
  centerPopover,
  isRectDisplayed,
  layoutForWidth,
  placePopover,
  sheetEdgeFor,
  spotlightFor,
} from '../helpers/geometry';
import { cycledFocusIndex, tourKeyAction } from '../helpers/keyboard';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const POPOVER = { width: 352, height: 260 };
const OPTIONS = { gap: 14, margin: 16, sides: ['right', 'bottom', 'left', 'top'] as const };

describe('tour geometry', () => {
  it('a target counts as on screen only when drawn and not pushed out sideways', () => {
    expect(isRectDisplayed({ top: 10, left: 10, width: 100, height: 40 }, DESKTOP)).toBe(true);
    expect(isRectDisplayed({ top: 10, left: 10, width: 0, height: 40 }, DESKTOP)).toBe(false);
    expect(isRectDisplayed({ top: 10, left: -100, width: 100, height: 40 }, DESKTOP)).toBe(false);
    expect(isRectDisplayed({ top: 10, left: 1280, width: 100, height: 40 }, DESKTOP)).toBe(false);
    // Below the fold still counts: it is scrolled into view, not skipped.
    expect(isRectDisplayed({ top: 2000, left: 10, width: 100, height: 40 }, DESKTOP)).toBe(true);
  });

  it('the spotlight grows the target by its padding and stays inside the viewport', () => {
    expect(spotlightFor({ top: 100, left: 100, width: 200, height: 50 }, 8, DESKTOP)).toEqual({
      top: 92,
      left: 92,
      width: 216,
      height: 66,
    });
    expect(spotlightFor({ top: 2, left: 1250, width: 100, height: 20 }, 8, DESKTOP)).toEqual({
      top: 0,
      left: 1242,
      width: 38,
      height: 30,
    });
  });

  it('the popover takes the first side with room, centred on the target and kept in the viewport', () => {
    const sidebarLink = { top: 300, left: 20, width: 230, height: 48 };
    expect(placePopover(sidebarLink, POPOVER, DESKTOP, OPTIONS)).toEqual({
      side: 'right',
      left: 264,
      top: 194,
    });
    const fullWidth = { top: 100, left: 0, width: 1280, height: 120 };
    expect(placePopover(fullWidth, POPOVER, DESKTOP, OPTIONS)).toEqual({
      side: 'bottom',
      left: 464,
      top: 234,
    });
    const nearTop = { top: 2, left: 900, width: 360, height: 30 };
    expect(placePopover(nearTop, POPOVER, DESKTOP, OPTIONS)?.side).toBe('bottom');
    const everywhere = { top: 0, left: 0, width: 1280, height: 800 };
    expect(placePopover(everywhere, POPOVER, DESKTOP, OPTIONS)).toBeNull();
  });

  it('the last side with room just fits (boundary)', () => {
    // right edge: 20 + 230 + 14 + 352 = 616 ≤ 640 − 16 → fits; one pixel wider does not.
    const viewport = { width: 640, height: 800 };
    expect(
      placePopover({ top: 300, left: 20, width: 230, height: 48 }, POPOVER, viewport, OPTIONS)
        ?.side,
    ).toBe('right');
    expect(
      placePopover({ top: 300, left: 20, width: 239, height: 48 }, POPOVER, viewport, OPTIONS)
        ?.side,
    ).not.toBe('right');
  });

  it('centres a popover with no target', () => {
    expect(centerPopover(POPOVER, DESKTOP)).toEqual({ side: 'center', top: 270, left: 464 });
    expect(centerPopover({ width: 2000, height: 2000 }, DESKTOP)).toEqual({
      side: 'center',
      top: 0,
      left: 0,
    });
  });

  it('phones get a sheet below 640 px', () => {
    expect(layoutForWidth(639, 640)).toBe('sheet');
    expect(layoutForWidth(640, 640)).toBe('floating');
  });

  it('the sheet rests away from its target: on top for a tab-bar target', () => {
    expect(sheetEdgeFor(null, PHONE)).toBe('bottom');
    expect(sheetEdgeFor({ top: 100, left: 0, width: 390, height: 100 }, PHONE)).toBe('bottom');
    expect(sheetEdgeFor({ top: 770, left: 20, width: 60, height: 56 }, PHONE)).toBe('top');
  });

  it('arranges a phone step as a sheet and a desktop step next to its target', () => {
    const target = { top: 770, left: 20, width: 60, height: 56 };
    expect(arrangeTour({ viewport: PHONE, target, popover: POPOVER })).toMatchObject({
      layout: 'sheet',
      placement: null,
      sheetEdge: 'top',
    });
    const desktop = arrangeTour({
      viewport: DESKTOP,
      target: { top: 300, left: 20, width: 230, height: 48 },
      popover: POPOVER,
    });
    expect(desktop.layout).toBe('floating');
    expect(desktop.spotlight.left).toBe(20 - SPOTLIGHT_PADDING);
    expect(desktop.placement?.side).toBe('right');
  });

  it('a centred step closes the spotlight to a point in the middle', () => {
    const welcome = arrangeTour({ viewport: DESKTOP, target: null, popover: POPOVER });
    expect(welcome.spotlight).toEqual({ top: 400, left: 640, width: 0, height: 0 });
    expect(welcome.placement?.side).toBe('center');
  });
});

describe('tour keyboard', () => {
  it('maps arrows and Escape, nothing else', () => {
    expect(tourKeyAction('ArrowRight')).toBe('next');
    expect(tourKeyAction('ArrowLeft')).toBe('back');
    expect(tourKeyAction('Escape')).toBe('close');
    expect(tourKeyAction('Enter')).toBeNull();
  });

  it('Tab cycles inside the dialog in both directions', () => {
    expect(cycledFocusIndex(-1, 3, false)).toBe(0);
    expect(cycledFocusIndex(-1, 3, true)).toBe(2);
    expect(cycledFocusIndex(2, 3, false)).toBe(0);
    expect(cycledFocusIndex(0, 3, true)).toBe(2);
    expect(cycledFocusIndex(1, 3, false)).toBe(2);
  });
});

describe('tour trigger (one-shot, per sign-in)', () => {
  beforeEach(() => sessionStorage.clear());
  const storage = () => window.sessionStorage;

  it('a sign-in asks for the tour once: the home takes the request and it is gone', () => {
    expect(hasPendingTour(storage)).toBe(false);
    requestTourAfterSignIn(storage);
    expect(sessionStorage.getItem(TOUR_PENDING_KEY)).toBe('1');
    expect(hasPendingTour(storage)).toBe(true);
    clearPendingTour(storage);
    expect(hasPendingTour(storage)).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it('the E2E bypass key keeps a pending tour from starting', () => {
    requestTourAfterSignIn(storage);
    sessionStorage.setItem(TOUR_SKIP_KEY, '1');
    expect(hasPendingTour(storage)).toBe(false);
  });

  it('blocked storage never starts it and writing never throws', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    expect(hasPendingTour(blocked)).toBe(false);
    expect(() => requestTourAfterSignIn(blocked)).not.toThrow();
    expect(() => clearPendingTour(blocked)).not.toThrow();
  });
});

describe('stepRouteToVisit', () => {
  const step = { id: 's', title: 't', body: 'b', pose: 'point' as const, targets: [] };

  it('opens the step page only when the customer is elsewhere, in either language', () => {
    expect(stepRouteToVisit({ ...step, route: '/app/store' }, '/app')).toBe('/app/store');
    expect(stepRouteToVisit({ ...step, route: '/app/store' }, '/en/app/store')).toBeNull();
    expect(stepRouteToVisit({ ...step, route: '/app' }, '/app/')).toBeNull();
  });

  it('a step without a route stays where it is', () => {
    expect(stepRouteToVisit(step, '/app/card')).toBeNull();
  });
});
