import type { TourKeyAction } from '../types';

/** The tour's shortcuts: arrows move between steps, Escape leaves. */
export function tourKeyAction(key: string): TourKeyAction | null {
  switch (key) {
    case 'ArrowRight':
      return 'next';
    case 'ArrowLeft':
      return 'back';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}

/**
 * Where Tab moves focus inside the dialog, wrapping at both ends (focus never leaves it).
 * `current` is -1 when focus is outside: Tab enters at the first control, Shift+Tab at the last.
 */
export function cycledFocusIndex(current: number, count: number, backwards: boolean): number {
  if (current === -1) return backwards ? count - 1 : 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}
