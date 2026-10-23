import type { ReactNode } from 'react';

/** The big number of a card: display type, tabular. */
export function KpiFigure({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-h3 leading-none font-bold wrap-break-word tabular-nums sm:text-h2 lg:text-h2-lg">
      {children}
    </p>
  );
}
