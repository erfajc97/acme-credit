import type { MascotPose } from '@acme/ui';
import { ROUTES } from '@/app/lib/endpoints';

export interface TourStep {
  id: string;
  /** The section page the step opens (ClientRouter, same document). */
  route: string;
  /** The section content the step spotlights on that page. */
  target: string;
  pose: MascotPose;
}

const section = (id: string) => `[data-tour="${id}"]`;

/**
 * The console in five stops, in the order an operator works: the figures, then the purchases,
 * accounts, payouts and audit trail pages, each spotlighting its content. Copy:
 * `tour.steps.<id>.title|body`.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'kpis', route: ROUTES.dashboard, target: section('kpis'), pose: 'wave' },
  { id: 'purchases', route: ROUTES.purchases, target: section('purchases'), pose: 'point' },
  { id: 'accounts', route: ROUTES.accounts, target: section('accounts'), pose: 'think' },
  { id: 'payouts', route: ROUTES.payouts, target: section('payouts'), pose: 'walk' },
  { id: 'auditLog', route: ROUTES.auditLog, target: section('auditLog'), pose: 'celebrate' },
];
