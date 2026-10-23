import type { ReactNode } from 'react';

interface ListHeadingProps {
  id?: string;
  /** Callback ref from useListPager: the pager moves focus here after a page change. */
  bind: (element: HTMLHeadingElement | null) => void;
  className: string;
  children: ReactNode;
}

/**
 * A list's h2 that can take focus programmatically (tabIndex -1, never in the Tab order) so a page
 * change hands focus back to the top of the new rows.
 */
export function ListHeading({ id, bind, className, children }: ListHeadingProps) {
  return (
    <h2 id={id} ref={bind} tabIndex={-1} className={className}>
      {children}
    </h2>
  );
}
