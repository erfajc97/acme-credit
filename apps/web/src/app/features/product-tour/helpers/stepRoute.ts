import { splitLocalePath } from '@/app/i18n/routing';
import type { TourStep } from '../types';

/** The route to open before showing `step`, or null when the step is already on this page. */
export function stepRouteToVisit(step: TourStep, pathname: string): string | null {
  if (!step.route) return null;
  return splitLocalePath(pathname).path === step.route ? null : step.route;
}
