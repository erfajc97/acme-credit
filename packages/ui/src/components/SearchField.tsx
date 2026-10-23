import { FieldError, Label, SearchField as HeroSearchField } from '@heroui/react';
import { definedProps } from './definedProps';

export interface SearchFieldProps {
  /** Visible label: names the box and its search landmark (W10). */
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter: search now, without waiting for a debounce. */
  onSubmit: (value: string) => void;
  /** The clear button (and Esc): empties the box and the search. */
  onClear: () => void;
  placeholder?: string | undefined;
  /** Accessible name of the clear button. */
  clearLabel: string;
  maxLength?: number | undefined;
  /** Already translated; its presence marks the field invalid. */
  errorMessage?: string | undefined;
}

/**
 * A list's search box (W7): HeroUI v3 SearchField (react-aria) with a visible label, a search
 * icon, a 44 px clear button and an announced error, inside a `search` landmark. Dumb: the caller
 * owns the text, the debounce and the URL.
 */
export function SearchField({
  label,
  name,
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
  clearLabel,
  maxLength,
  errorMessage,
}: SearchFieldProps) {
  return (
    <div role="search" className="w-full max-w-xl min-w-0">
      <HeroSearchField
        name={name}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        onClear={onClear}
        {...definedProps({ maxLength })}
        isInvalid={Boolean(errorMessage)}
        validationBehavior="aria"
        fullWidth
        className="flex flex-col gap-1"
      >
        <Label className="text-small font-medium text-fg">{label}</Label>
        <HeroSearchField.Group className="h-11 rounded-field">
          <HeroSearchField.SearchIcon className="size-4 shrink-0 text-muted" />
          <HeroSearchField.Input
            {...definedProps({ placeholder })}
            autoComplete="off"
            className="h-full min-w-0 grow text-body"
          />
          <HeroSearchField.ClearButton
            aria-label={clearLabel}
            className="size-11 min-w-11 shrink-0 rounded-control"
          />
        </HeroSearchField.Group>
        <FieldError className="text-small text-danger">{errorMessage}</FieldError>
      </HeroSearchField>
    </div>
  );
}
