import { TextField, type TextFieldProps } from './TextField';

export interface MoneyFieldProps extends Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'prefix' | 'isMono' | 'autoComplete'
> {
  /** The currency sign drawn before the amount, e.g. "$". */
  currencySymbol: string;
}

/**
 * Amounts are text, never `type="number"` (W11): the decimal keyboard on phones and the value
 * kept exactly as typed, for the app's money parser to accept or flag (never auto-correct).
 */
export function MoneyField({ currencySymbol, maxLength = 16, ...props }: MoneyFieldProps) {
  return (
    <TextField
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      maxLength={maxLength}
      prefix={currencySymbol}
      isMono
    />
  );
}
