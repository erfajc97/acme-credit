import type { ReactNode } from 'react';
import { fullButtonClass, type AppButtonVariant } from './buttonStyles';

interface ButtonLinkClassOptions {
  variant?: AppButtonVariant;
  fullWidth?: boolean;
  /** "compact" keeps the 44 px target with tighter padding (two buttons side by side on phones). */
  size?: 'regular' | 'compact';
}

/**
 * The button look for an `<a>`: navigation stays a link (W10) while it reads as an action.
 * Exported so `.astro` pages style static links without an island (WA1).
 */
export function buttonLinkClass(options: ButtonLinkClassOptions = {}): string {
  return fullButtonClass(options);
}

export interface ButtonLinkProps extends ButtonLinkClassOptions {
  href: string;
  children: ReactNode;
  /** Opens in a new tab (the payment simulator) with rel="noopener noreferrer". */
  external?: boolean;
  /** Hover/focus intent, e.g. to prefetch the next screen's data. */
  onIntent?: (() => void) | undefined;
}

export function ButtonLink({
  href,
  children,
  external = false,
  onIntent,
  ...style
}: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={buttonLinkClass(style)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...(onIntent ? { onPointerEnter: onIntent, onFocus: onIntent } : {})}
    >
      {children}
    </a>
  );
}
