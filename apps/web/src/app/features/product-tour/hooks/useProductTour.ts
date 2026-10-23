import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { localHref, navigateTo, TOUR_PARAM } from '@/app/helpers/navigation';
import { clearPendingTour, hasPendingTour } from '@/app/helpers/tourTrigger';
import { t } from '@/app/i18n';
import { TOUR_ANCHOR, TOUR_STEPS } from '../data';
import { arrangeTour } from '../helpers/geometry';
import { cycledFocusIndex, tourKeyAction } from '../helpers/keyboard';
import { stepRouteToVisit } from '../helpers/stepRoute';
import { useTourGeometry } from './useTourGeometry';

const sessionStorageOf = () => window.sessionStorage;

/** Runs `onRendered` once `selector` matches: now, or after a later change of the DOM. */
function whenRendered(selector: string, onRendered: () => void): () => void {
  if (document.querySelector(selector)) {
    onRendered();
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    if (!document.querySelector(selector)) return;
    observer.disconnect();
    onRendered();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Drops `?tour=1` from the address bar, so a reload does not replay the tour. */
function forgetReplayRequest(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(TOUR_PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/**
 * The wallet tour: whether it shows and which step, its controls (next / back / skip, keyboard),
 * and where the spotlight and the popover go. It starts by itself when the home with an open card
 * follows a sign-in (helpers/tourTrigger), and on demand with `?tour=1`.
 */
export function useProductTour() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const runningRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  // Effect (W3, last resort): the start waits for the home's figures, rendered by the Account
  // island once its data arrives; only the DOM can tell when. The tour lives in the persisted app
  // shell, so a ClientRouter visit (Profile › "Ver tutorial" → `/app?tour=1`) is a page-load
  // event, not a new mount: each one checks again (WA4). No network.
  useEffect(() => {
    let stopWaiting: () => void = () => undefined;
    const check = () => {
      stopWaiting();
      if (runningRef.current) return;
      const isReplay = new URLSearchParams(window.location.search).get(TOUR_PARAM) === '1';
      if (!isReplay && !hasPendingTour(sessionStorageOf)) return;
      stopWaiting = whenRendered(TOUR_ANCHOR, () => {
        if (isReplay) forgetReplayRequest();
        clearPendingTour(sessionStorageOf);
        returnFocusRef.current = document.activeElement;
        runningRef.current = true;
        setStepIndex(0);
      });
    };
    check();
    document.addEventListener('astro:page-load', check);
    return () => {
      stopWaiting();
      document.removeEventListener('astro:page-load', check);
    };
  }, []);

  const step = stepIndex === null ? null : (TOUR_STEPS[stepIndex] ?? null);
  const measurement = useTourGeometry(step, popoverRef);
  const lastIndex = TOUR_STEPS.length - 1;

  const close = () => {
    runningRef.current = false;
    setStepIndex(null);
    // The element that had focus may belong to a page the tour left behind.
    if (returnFocusRef.current instanceof HTMLElement && returnFocusRef.current.isConnected) {
      returnFocusRef.current.focus();
    }
  };
  /** Shows a step, opening its page first (ClientRouter) when it lives on another one. */
  const goTo = (index: number) => {
    const target = TOUR_STEPS[index];
    if (!target) return;
    setStepIndex(index);
    const route = stepRouteToVisit(target, window.location.pathname);
    if (route) navigateTo(localHref(route));
  };
  const next = () => {
    if (stepIndex === null) return;
    if (stepIndex >= lastIndex) close();
    else goTo(stepIndex + 1);
  };
  const back = () => {
    if (stepIndex !== null && stepIndex > 0) goTo(stepIndex - 1);
  };
  const actions = { next, back, close } as const;
  const stepNumber = (stepIndex ?? 0) + 1;

  return {
    step,
    title: step ? t(step.title) : '',
    body: step ? t(step.body) : '',
    progress: {
      current: stepNumber,
      total: TOUR_STEPS.length,
      label: t('tour.progress', { current: stepNumber, total: TOUR_STEPS.length }),
      announcement: step
        ? t('tour.announcement', {
            current: stepNumber,
            total: TOUR_STEPS.length,
            title: t(step.title),
          })
        : '',
    },
    isFirst: stepIndex === 0,
    isLast: stepIndex === lastIndex,
    hasTarget: Boolean(measurement?.target),
    arrangement: measurement ? arrangeTour(measurement) : null,
    ids: { titleId, bodyId },
    popoverRef,
    next,
    back,
    close,
    /** Arrows and Escape drive the tour; Tab cycles inside the dialog (it is modal). */
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Tab') {
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'),
        ];
        if (controls.length === 0) return;
        event.preventDefault();
        const current = controls.findIndex((control) => control === document.activeElement);
        controls[cycledFocusIndex(current, controls.length, event.shiftKey)]?.focus();
        return;
      }
      const action = tourKeyAction(event.key);
      if (!action) return;
      event.preventDefault();
      actions[action]();
    },
    /** A press on the dimmed page does nothing and keeps focus in the dialog. */
    onBackdropMouseDown: (event: MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) event.preventDefault();
    },
  };
}
