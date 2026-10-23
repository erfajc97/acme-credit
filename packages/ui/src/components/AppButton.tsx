import { Button } from '@heroui/react';
import type { ReactNode } from 'react';
import { brandButtonClass, type AppButtonVariant } from './buttonStyles';
import { definedProps } from './definedProps';

export type { AppButtonVariant } from './buttonStyles';

interface BaseProps {
  children: ReactNode;
  variant?: AppButtonVariant;
  type?: 'button' | 'submit';
  onPress?: (() => void) | undefined;
  isDisabled?: boolean;
  fullWidth?: boolean;
  /** "compact" keeps the 44 px target with tighter padding (list rows, toolbars). */
  size?: 'regular' | 'compact';
  'aria-label'?: string | undefined;
  /** Takes focus when it mounts, e.g. when it replaces the control the user just used. */
  focusOnMount?: boolean;
}

/**
 * A button that can be pending must say so in words: HeroUI v3 has no isLoading and draws no
 * spinner (WA8), so `pendingLabel` is required whenever `isPending` is passed (W13).
 */
type PendingProps =
  { isPending: boolean; pendingLabel: string } | { isPending?: never; pendingLabel?: never };

export type AppButtonProps = BaseProps & PendingProps;

/** The project's button (W7): pill, 44 px+ target, the yellow press edge on primary. */
export function AppButton({
  children,
  variant = 'primary',
  type = 'button',
  onPress,
  isDisabled = false,
  isPending = false,
  pendingLabel,
  fullWidth = false,
  size = 'regular',
  'aria-label': ariaLabel,
  focusOnMount = false,
}: AppButtonProps) {
  return (
    <Button
      variant={variant}
      type={type}
      {...definedProps({ onPress, 'aria-label': ariaLabel })}
      isDisabled={isDisabled}
      // Only on an explicit hand-off (the control the user pressed was replaced), never on load.
      // eslint-disable-next-line jsx-a11y/no-autofocus -- focus must follow the replaced control (WCAG 2.4.3).
      autoFocus={focusOnMount}
      isPending={isPending}
      fullWidth={fullWidth}
      size="lg"
      className={brandButtonClass({ variant, size })}
    >
      {isPending ? pendingLabel : children}
    </Button>
  );
}
