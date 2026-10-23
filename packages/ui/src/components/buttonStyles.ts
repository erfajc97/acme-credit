import { buttonVariants } from '@heroui/react';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * The brand look on top of HeroUI's button (docs/brand.md › Direction): every control is a pill
 * with a 44 px+ target. Primary is the yellow pill with its solid darker bottom edge that reads as
 * pressable; pressed, it sinks 3 px and loses the edge (HeroUI's scale is replaced). Secondary is
 * the outlined pill, ghost has no frame until hovered.
 */
const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary:
    'font-semibold shadow-press data-pressed:translate-y-0.75 data-pressed:transform-none data-pressed:shadow-none active:translate-y-0.75 active:transform-none active:shadow-none',
  secondary:
    'border-[1.6px] border-ink bg-surface-raised font-semibold text-fg hover:bg-neutral-soft data-pressed:translate-y-px data-pressed:transform-none',
  ghost: 'font-medium text-fg data-pressed:transform-none',
  danger: 'font-semibold data-pressed:translate-y-px data-pressed:transform-none',
};

export interface ButtonClassOptions {
  variant?: AppButtonVariant;
  fullWidth?: boolean;
  /** "compact" keeps 44 px but tighter padding (toolbars, list rows). */
  size?: 'regular' | 'compact';
}

/** Classes HeroUI's Button gets through `className` (the variant/size props stay HeroUI's). */
export function brandButtonClass({
  variant = 'primary',
  size = 'regular',
}: ButtonClassOptions): string {
  const sizeClass = size === 'compact' ? 'h-11 px-4 md:h-11' : 'h-12 px-6 md:h-12';
  return `rounded-control ${sizeClass} ${VARIANT_CLASS[variant]}`;
}

/** The full class list of a link or label drawn as a button (no HeroUI component behind it). */
export function fullButtonClass(options: ButtonClassOptions = {}): string {
  const { variant = 'primary', fullWidth = false } = options;
  return `${buttonVariants({ variant, size: 'lg', fullWidth })} ${brandButtonClass(options)}`;
}
