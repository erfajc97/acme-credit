import { useLayoutEffect, useState, type RefObject } from 'react';
import { POPOVER_FALLBACK_SIZE, TALL_TARGET_SHARE } from '../data';
import { isRectDisplayed } from '../helpers/geometry';
import type { Size, TourMeasurement, TourStep } from '../types';

function currentViewport(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The first of the step's targets laid out on screen (tab bar on phones, sidebar on desktop). */
function findTarget(step: TourStep, viewport: Size): HTMLElement | null {
  for (const selector of step.targets) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (isRectDisplayed(element.getBoundingClientRect(), viewport)) return element;
    }
  }
  return null;
}

function measure(
  target: HTMLElement | null,
  popover: HTMLElement | null,
  viewport: Size,
): TourMeasurement {
  const rect = target?.getBoundingClientRect();
  return {
    viewport,
    target: rect
      ? {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: Math.min(rect.height, viewport.height * TALL_TARGET_SHARE),
        }
      : null,
    popover:
      popover && popover.offsetWidth > 0
        ? { width: popover.offsetWidth, height: popover.offsetHeight }
        : POPOVER_FALLBACK_SIZE,
  };
}

/** Smooth unless the customer asked for less motion (W10). */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Where the current step's target is and how big the popover came out, kept current through
 * resizes, scrolls and DOM changes. The target may not exist yet (its island is still loading, or
 * the step just opened another page through the ClientRouter): it is looked for again on every
 * DOM change, and the first time it shows up it is scrolled into view (centred, or from its top
 * when it is taller than TALL_TARGET_SHARE of the screen, which is also where the frame stops). Null until the first measurement.
 */
export function useTourGeometry(
  step: TourStep | null,
  popoverRef: RefObject<HTMLElement | null>,
): TourMeasurement | null {
  const [measurement, setMeasurement] = useState<TourMeasurement | null>(null);

  // Layout effect (W3, last resort): the targets belong to the static shell and other islands, so
  // only the DOM knows where they are, and they move with resizes, scrolls and page swaps React
  // never sees. Measured before paint, so a new step never shows a frame in the old place. No
  // network.
  useLayoutEffect(() => {
    if (!step) return;
    let framed: HTMLElement | null = null;
    let frame = 0;
    const update = () => {
      const viewport = currentViewport();
      const target = findTarget(step, viewport);
      if (target && target !== framed) {
        framed = target;
        // A tall section is shown from its top (its heading and first rows), a short one centred.
        const isTall = target.getBoundingClientRect().height > viewport.height * TALL_TARGET_SHARE;
        target.scrollIntoView({ block: isTall ? 'start' : 'center', behavior: scrollBehavior() });
      }
      setMeasurement(measure(target, popoverRef.current, viewport));
    };
    // DOM changes come in bursts (an island rendering a list): one measurement per frame.
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const resizes = new ResizeObserver(update);
    resizes.observe(document.documentElement);
    if (popoverRef.current) resizes.observe(popoverRef.current);
    const mutations = new MutationObserver(scheduleUpdate);
    // The documentElement, not body: a ClientRouter swap replaces <body> itself.
    mutations.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true });
    };
  }, [step, popoverRef]);

  return measurement;
}
