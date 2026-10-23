import type { LucideIcon } from 'lucide-react';

export interface IconProps {
  icon: LucideIcon;
  size?: 16 | 20 | 24;
}

/** The one door to the icon set (docs/brand.md › Icons): Lucide outline, 1.5 px stroke. */
export function Icon({ icon: Glyph, size = 20 }: IconProps) {
  return <Glyph aria-hidden="true" focusable="false" size={size} strokeWidth={1.5} />;
}
