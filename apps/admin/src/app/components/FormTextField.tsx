import { TextField, type TextFieldProps } from '@acme/ui';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { VALIDATION_PARAMS } from '@/app/helpers/validationParams';
import { t } from '@/app/i18n';

type FieldProps = Omit<
  TextFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'inputRef' | 'errorMessage'
>;

interface FormTextFieldProps<T extends FieldValues, TOut> extends FieldProps {
  control: Control<T, unknown, TOut>;
  name: Path<T>;
}

/**
 * Binds a react-hook-form field to the TextField wrapper (W11). Schema messages are i18n keys,
 * translated here so every form shows its errors the same way.
 */
export function FormTextField<T extends FieldValues, TOut = T>({
  control,
  name,
  ...field
}: FormTextFieldProps<T, TOut>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur, ref }, fieldState: { error } }) => (
        <TextField
          {...field}
          name={name}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          onBlur={onBlur}
          inputRef={ref}
          errorMessage={error?.message ? t(error.message, VALIDATION_PARAMS) : undefined}
        />
      )}
    />
  );
}
