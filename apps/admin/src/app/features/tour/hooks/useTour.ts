import { useEffect, useState } from 'react';
import { navigateTo } from '@/app/helpers/navigation';
import { takeTourRequest } from '@/app/helpers/tourTrigger';
import { t } from '@/app/i18n';
import { splitLocalePath } from '@/app/i18n/routing';
import { localHref } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';
import { useTourStore } from '@/app/store/tourStore';
import { TOUR_STEPS } from '../data';
import { watchTarget } from '../helpers/spotlight';
import type { TourLayout } from '../helpers/tourLayout';

const isOnRoute = (route: string) => splitLocalePath(window.location.pathname).path === route;

/**
 * The console's product tour: five steps with Credi, opened after every successful sign-in
 * (helpers/tourTrigger, never on a reload) or by the session menu's "Take the tour". Each step
 * opens its section page through the ClientRouter (the island persists across pages) and
 * spotlights the section: the page is dimmed around a cut-out and the card is anchored beside
 * it, both recomputed on scroll and resize. Esc or "Skip" closes it.
 */
export function useTour() {
  const index = useTourStore((state) => state.index);
  const signedIn = useAuthStore((state) => state.status === 'authenticated');
  const [card, setCard] = useState<HTMLElement | null>(null);
  const [layout, setLayout] = useState<TourLayout | null>(null);

  useEffect(() => {
    // Mount gate (WA2): the tab's storage exists only in the browser; a sign-in's request is
    // taken once the session is there.
    if (signedIn && takeTourRequest(window.sessionStorage)) useTourStore.getState().start();
  }, [signedIn]);

  const step = index === null || !signedIn ? null : (TOUR_STEPS[index] ?? null);

  useEffect(() => {
    // Syncs the address (an external system) with the step: its section page, same document.
    if (step && !isOnRoute(step.route)) navigateTo(localHref(step.route));
  }, [step]);

  useEffect(() => {
    // Syncs the spotlight with the section on the page (it may still be loading or swapping in).
    if (!step) return undefined;
    return watchTarget({ selector: step.target, card, onLayout: setLayout });
  }, [step, card]);

  useEffect(() => {
    // Esc closes the tour from anywhere on the page (focus may be outside the card).
    if (!step) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useTourStore.getState().close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  const { goTo, close } = useTourStore.getState();
  const current = index ?? 0;
  const isLast = current === TOUR_STEPS.length - 1;

  return {
    step: step
      ? {
          id: step.id,
          pose: step.pose,
          title: t(`tour.steps.${step.id}.title`),
          body: t(`tour.steps.${step.id}.body`),
          progress: t('tour.progress', { current: current + 1, total: TOUR_STEPS.length }),
          isFirst: current === 0,
          isLast,
        }
      : null,
    /** Null while the section is not on the page yet: the whole page is dimmed meanwhile. */
    layout,
    measureCard: setCard,
    next: () => (isLast ? close() : goTo(current + 1)),
    back: () => goTo(Math.max(0, current - 1)),
    close,
  };
}

export type TourView = Omit<ReturnType<typeof useTour>, 'measureCard'>;
