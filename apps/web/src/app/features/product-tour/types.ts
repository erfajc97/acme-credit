import type { MascotPose } from '@acme/ui';

/** One stop of the wallet tour, guided by Credi in a pose. */
export interface TourStep {
  id: string;
  /** i18n keys. */
  title: string;
  body: string;
  pose: MascotPose;
  /**
   * CSS selectors of what the step points at, in order of preference: the first one laid out on
   * screen wins (the phone tab bar or the desktop sidebar). Empty: a centred card (intro, end).
   */
  targets: readonly string[];
  /**
   * The app route the step shows (ROUTES.*): reaching a step on another page navigates there
   * through the ClientRouter first, then spotlights the target once it renders. Absent: stays.
   */
  route?: string;
}

/** A box in viewport coordinates (what `getBoundingClientRect` reports). */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type PopoverSide = 'right' | 'bottom' | 'left' | 'top';

/** Where the popover's top-left corner goes, and on which side of the target it sits. */
export interface PopoverPlacement {
  top: number;
  left: number;
  side: PopoverSide | 'center';
}

/** Floating next to its target (tablet and desktop), or a bottom/top sheet (phones). */
export type TourLayout = 'floating' | 'sheet';
export type SheetEdge = 'bottom' | 'top';

export type TourKeyAction = 'next' | 'back' | 'close';

/** What the page looks like around the current step, measured from the DOM. */
export interface TourMeasurement {
  viewport: Size;
  /** The step's target on screen; null for a centred step. */
  target: Rect | null;
  popover: Size;
}

/** Where the spotlight and the popover go for one measurement. */
export interface TourArrangement {
  layout: TourLayout;
  spotlight: Rect;
  /** Null on the sheet layout: CSS pins it to an edge. */
  placement: PopoverPlacement | null;
  sheetEdge: SheetEdge;
}
