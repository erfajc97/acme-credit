import { Button } from '@heroui/react';

export interface QuantityStepperProps {
  /** Names the group, e.g. "Quantity of Horchata". */
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  /** When given, "−" at the minimum removes the item instead of being disabled. */
  onRemove?: (() => void) | undefined;
  removeLabel?: string | undefined;
  /** "+" takes focus when the stepper mounts (it just replaced the "Add" button). */
  focusIncreaseOnMount?: boolean;
}

const STEP_CLASS =
  'size-11 min-w-11 rounded-control border-[1.6px] border-ink bg-surface-raised font-mono text-h3 text-fg hover:bg-neutral-soft data-pressed:transform-none data-pressed:translate-y-px';

/**
 * − value + with 44 px targets (W9). The value is announced politely when it changes; the
 * buttons carry translated names because their glyphs are decorative (W10).
 */
export function QuantityStepper({
  label,
  value,
  min = 1,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  onRemove,
  removeLabel,
  focusIncreaseOnMount = false,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const removes = atMin && onRemove !== undefined;
  const onDecrease = () => (removes ? onRemove() : onChange(value - 1));
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <Button
        isIconOnly
        variant="secondary"
        aria-label={removes ? (removeLabel ?? decreaseLabel) : decreaseLabel}
        isDisabled={atMin && !removes}
        onPress={onDecrease}
        className={STEP_CLASS}
      >
        <span aria-hidden="true">−</span>
      </Button>
      <output
        aria-live="polite"
        className="min-w-8 text-center font-mono text-body font-medium tabular-nums"
      >
        {value}
      </output>
      <Button
        isIconOnly
        variant="secondary"
        aria-label={increaseLabel}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- focus must follow the replaced "Add" button (WCAG 2.4.3).
        autoFocus={focusIncreaseOnMount}
        isDisabled={value >= max}
        onPress={() => onChange(value + 1)}
        className={STEP_CLASS}
      >
        <span aria-hidden="true">+</span>
      </Button>
    </div>
  );
}
