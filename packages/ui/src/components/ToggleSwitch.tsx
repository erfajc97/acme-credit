import { Description, Label, Switch } from '@heroui/react';

export interface ToggleSwitchProps {
  /** The visible label, also the switch's accessible name. */
  label: string;
  /** What switching does, read with the label (aria-describedby). */
  description?: string | undefined;
  isSelected: boolean;
  /** Receives the requested state; a controlled caller may confirm first and keep `isSelected`. */
  onChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
}

/**
 * The project's switch (WA8): HeroUI v3 needs Switch.Content + Switch.Control + Switch.Thumb. The
 * whole row is the 44 px+ target; on = the yellow track with its ink outline.
 */
export function ToggleSwitch({
  label,
  description,
  isSelected,
  onChange,
  isDisabled = false,
}: ToggleSwitchProps) {
  return (
    <Switch
      size="lg"
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      className="flex w-full flex-col gap-1"
    >
      <Switch.Content className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-control">
        <Label className="font-display text-body font-bold text-fg">{label}</Label>
        <Switch.Control className="border-[1.6px] border-ink">
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
      {description && (
        <Description className="max-w-prose ps-0 text-small text-muted">{description}</Description>
      )}
    </Switch>
  );
}
