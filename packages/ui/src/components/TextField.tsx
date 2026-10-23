import { Description, FieldError, Input, Label, TextField as HeroTextField } from '@heroui/react';
import type { HTMLAttributes, Ref } from 'react';
import { definedProps } from './definedProps';

export interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  inputRef?: Ref<HTMLInputElement> | undefined;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string | undefined;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number | undefined;
  description?: string | undefined;
  /** Already translated; its presence marks the field invalid. */
  errorMessage?: string | undefined;
  isRequired?: boolean;
  isDisabled?: boolean;
  /** A short symbol drawn inside the field before the value (a currency sign). */
  prefix?: string | undefined;
  /** Amounts are set in the mono face (docs/brand.md › Amounts). */
  isMono?: boolean;
}

/**
 * HeroUI v3 `Input` takes no label (WA8): this composes TextField + Label + Input + Description +
 * FieldError, so every field has an associated label and an announced error (W10). The ring is
 * inset so it is not clipped inside dialogs.
 */
export function TextField({
  label,
  name,
  value,
  onChange,
  onBlur,
  inputRef,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  description,
  errorMessage,
  isRequired = false,
  isDisabled = false,
  prefix,
  isMono = false,
}: TextFieldProps) {
  const inputClass = [
    'box-border h-12 w-full max-w-full rounded-field text-body focus:ring-inset',
    prefix ? 'pl-7' : '',
    isMono ? 'font-mono tabular-nums' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <HeroTextField
      name={name}
      value={value}
      onChange={onChange}
      {...definedProps({ onBlur, maxLength })}
      type={type}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      validationBehavior="aria"
      fullWidth
      className="flex flex-col gap-1.5"
    >
      <Label className="text-small font-medium text-fg">{label}</Label>
      <div className="relative">
        {prefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-muted"
          >
            {prefix}
          </span>
        )}
        <Input
          {...definedProps({ ref: inputRef, autoComplete, inputMode })}
          className={inputClass}
        />
      </div>
      {description && <Description className="text-small text-muted">{description}</Description>}
      <FieldError className="text-small text-danger">{errorMessage}</FieldError>
    </HeroTextField>
  );
}
