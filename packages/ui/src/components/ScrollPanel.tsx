import type { ReactNode } from 'react';
import { useFitLayout } from '../fit-layout';

export interface ScrollPanelProps {
  children: ReactNode;
  /** Names the scrolling region for assistive tech (e.g. "Recent orders"). */
  label: string;
  /** Layout classes of the box; sizing that only applies while it scrolls uses the `fit:` variant. */
  className?: string;
}

/**
 * A box that scrolls on its own inside a screen that fits the viewport — only in the fit layout
 * (from lg with a mouse or trackpad, FIT_LAYOUT_QUERY). Everywhere else it is a plain block and the
 * page scrolls: a nested scroll box with contained overscroll traps every swipe that starts on it
 * (the "page does not scroll" bug on phones). While it scrolls, keyboard users can focus it and
 * use the arrow keys (WCAG 2.1.1); the wheel stays inside it and the focus ring inside the box.
 */
export function ScrollPanel({ children, label, className = '' }: ScrollPanelProps) {
  const scrolls = useFitLayout();
  if (!scrolls) return <div className={className}>{children}</div>;
  return (
    <div
      role="group"
      aria-label={label}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling box must be reachable by keyboard (WCAG 2.1.1).
      tabIndex={0}
      className={`rounded-field focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet fit:min-h-0 fit:overflow-y-auto fit:overscroll-contain ${className}`}
    >
      {children}
    </div>
  );
}
