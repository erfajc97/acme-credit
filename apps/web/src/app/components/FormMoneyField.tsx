import { MoneyField, type MoneyFieldProps } from '@acme/ui';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { CURRENCY_SYMBOL } from '@/app/helpers/money';
import { validationParams } from '@/app/helpers/validationParams';
import { t } from '@/app/i18n';

type FieldProps = Omit<
  MoneyFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'inputRef' | 'errorMessage' | 'currencySymbol'
>;

interface FormMoneyFieldProps<T extends FieldValues, TOut> extends FieldProps {
  control: Control<T, unknown, TOut>;
  name: Path<T>;
}

/** Binds a react-hook-form amount (kept as typed text) to the MoneyField wrapper (W11). */
export function FormMoneyField<T extends FieldValues, TOut = T>({
  control,
  name,
  ...field
}: FormMoneyFieldProps<T, TOut>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur, ref }, fieldState: { error } }) => (
        <MoneyField
          {...field}
          name={name}
          currencySymbol={CURRENCY_SYMBOL}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          onBlur={onBlur}
          inputRef={ref}
          errorMessage={error?.message ? t(error.message, validationParams()) : undefined}
        />
      )}
    />
  );
}
