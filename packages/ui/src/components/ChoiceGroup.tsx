import { FieldError, Label, Radio, RadioGroup } from '@heroui/react';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string | undefined;
}

export interface ChoiceGroupProps {
  label: string;
  name: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  errorMessage?: string | undefined;
}

/**
 * A single choice among a few visible options (radio group), each a ≥ 44 px row. Built on HeroUI
 * v3's RadioGroup parts so keyboard arrows and the group name come from react-aria (W10).
 */
export function ChoiceGroup({
  label,
  name,
  options,
  value,
  onChange,
  errorMessage,
}: ChoiceGroupProps) {
  return (
    <RadioGroup
      name={name}
      value={value}
      onChange={onChange}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      className="flex flex-col gap-2"
    >
      <Label className="text-small font-medium text-fg">{label}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            className="rounded-field border-[1.6px] border-border-strong bg-surface-raised px-3 py-2 data-selected:border-violet data-selected:bg-lavender"
          >
            <Radio.Content className="flex min-h-11 items-center gap-3">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <span className="flex flex-col">
                <Label>{option.label}</Label>
                {option.description && (
                  <span className="text-caption text-muted">{option.description}</span>
                )}
              </span>
            </Radio.Content>
          </Radio>
        ))}
      </div>
      <FieldError className="text-small text-danger">{errorMessage}</FieldError>
    </RadioGroup>
  );
}
