import { ROUTES } from '@/app/lib/endpoints';
import type { PopoverSide, Size, TourStep } from './types';

/** The tour starts once the home's figures are on screen (another island renders them). */
export const TOUR_ANCHOR = '[data-tour="available"]';

/**
 * A section taller than this share of the screen (the store grid, a list of 10 orders) is framed
 * from its top down to this height, so the spotlight still points at something and the popover
 * keeps room next to it.
 */
export const TALL_TARGET_SHARE = 0.55;
/** Room around the target inside the spotlight, px. */
export const SPOTLIGHT_PADDING = 8;
/** Space between the spotlight and the popover, px. */
export const POPOVER_GAP = 14;
/** Closest the popover gets to a viewport edge, px. */
export const VIEWPORT_MARGIN = 16;
/** Below Tailwind `sm` (40rem) the popover is a sheet: a floating card would cover its target. */
export const SHEET_BELOW_WIDTH = 640;
/** Size assumed until the popover is measured (its CSS width; a typical height). */
export const POPOVER_FALLBACK_SIZE: Size = { width: 352, height: 260 };
/** Sides tried in order: sidebar links open to the right, the home's panels below. */
export const SIDE_ORDER: readonly PopoverSide[] = ['right', 'bottom', 'left', 'top'];

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'tour.welcomeTitle',
    body: 'tour.welcomeBody',
    pose: 'wave',
    targets: [],
    route: ROUTES.app,
  },
  {
    id: 'card',
    title: 'tour.cardTitle',
    body: 'tour.cardBody',
    pose: 'point',
    targets: ['[data-tour="card-strip"]'],
    route: ROUTES.app,
  },
  {
    id: 'available',
    title: 'tour.availableTitle',
    body: 'tour.availableBody',
    pose: 'think',
    targets: [TOUR_ANCHOR],
    route: ROUTES.app,
  },
  {
    id: 'store',
    title: 'tour.storeTitle',
    body: 'tour.storeBody',
    pose: 'point',
    targets: ['[data-tour="store-products"]'],
    route: ROUTES.store,
  },
  {
    id: 'activity',
    title: 'tour.activityTitle',
    body: 'tour.activityBody',
    pose: 'think',
    targets: ['[data-tour="activity-orders"]'],
    route: ROUTES.activity,
  },
  {
    id: 'freeze',
    title: 'tour.freezeTitle',
    body: 'tour.freezeBody',
    pose: 'point',
    targets: ['[data-tour="card-settings"]'],
    route: ROUTES.card,
  },
  { id: 'done', title: 'tour.doneTitle', body: 'tour.doneBody', pose: 'celebrate', targets: [] },
];
