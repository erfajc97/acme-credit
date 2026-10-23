import type { MouseEvent, ReactNode } from 'react';
import type { Rect } from '../types';

interface TourOverlayProps {
  spotlight: Rect;
  hasTarget: boolean;
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}

/**
 * The dimmed page with a cutout over the current target. The layer takes every press (the page
 * stays put during the tour); the cutout is one element whose huge spread shadow is the dim, so
 * moving it is one transform and size change (`tour-spotlight`, global.css).
 */
export function TourOverlay({ spotlight, hasTarget, onMouseDown, children }: TourOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-60"
      data-testid="tour"
      onMouseDown={onMouseDown}
      role="presentation"
    >
      <div
        aria-hidden="true"
        data-testid="tour-spotlight"
        data-target={hasTarget ? '' : undefined}
        className="tour-spotlight"
        style={{
          width: spotlight.width,
          height: spotlight.height,
          transform: `translate3d(${spotlight.left}px, ${spotlight.top}px, 0)`,
        }}
      />
      {children}
    </div>
  );
}
