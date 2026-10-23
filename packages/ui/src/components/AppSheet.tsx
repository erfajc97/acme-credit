import { Drawer } from '@heroui/react';
import type { ReactNode } from 'react';
import { DESKTOP_QUERY, useMediaQuery } from '../fit-layout';

export interface AppSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * "bottom" is the phone sheet (thumb reach); "right" a desktop side panel; "auto" is the bottom
   * sheet below lg and the side panel from lg.
   */
  placement?: 'bottom' | 'right' | 'auto';
  /** Names the close button (e.g. "Close"); without it the sheet closes by swipe, Esc or backdrop only. */
  closeLabel?: string | undefined;
}

const PLACEMENT_CLASS = {
  bottom: 'max-h-[85dvh]',
  right: 'h-dvh w-full max-w-md',
} as const;

/**
 * A controlled sheet (HeroUI v3 Drawer). Like AppModal, a sheet opened from state controls the
 * Backdrop directly instead of a trigger root (WA8). react-aria moves focus into it, traps it
 * there and gives it back to the control that opened it. Outlined in ink with the hard overlay
 * shadow.
 */
export function AppSheet({
  isOpen,
  onOpenChange,
  title,
  children,
  footer,
  placement = 'bottom',
  closeLabel,
}: AppSheetProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const side = placement === 'auto' ? (isDesktop ? 'right' : 'bottom') : placement;
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement={side}>
        <Drawer.Dialog
          className={`border-[1.6px] border-ink bg-surface-raised text-fg ${PLACEMENT_CLASS[side]}`}
        >
          {side === 'bottom' && <Drawer.Handle />}
          <Drawer.Header className="flex flex-row items-center justify-between gap-3">
            <Drawer.Heading className="font-display text-h3 font-bold">{title}</Drawer.Heading>
            {closeLabel && (
              <Drawer.CloseTrigger
                aria-label={closeLabel}
                className="static size-11 min-w-11 rounded-control border-[1.6px] border-ink bg-surface-raised text-fg"
              />
            )}
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">{children}</Drawer.Body>
          {footer && <Drawer.Footer className="flex flex-col gap-2">{footer}</Drawer.Footer>}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
