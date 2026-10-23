import { AppButton } from '@acme/ui';
import type { BaseSyntheticEvent } from 'react';
import type { Control } from 'react-hook-form';
import { FormMoneyField } from '@/app/components/FormMoneyField';
import type { AmountFormInput, AmountFormValues } from '../types';

interface AmountFormProps {
  control: Control<AmountFormInput, unknown, AmountFormValues>;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  label: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
}

/** One amount and one verb: the shape of the deposit and payment forms. */
export function AmountForm({
  control,
  onSubmit,
  label,
  description,
  submitLabel,
  pendingLabel,
  isSubmitting,
}: AmountFormProps) {
  return (
    <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormMoneyField
        control={control}
        name="amount"
        label={label}
        description={description}
        isRequired
      />
      <AppButton type="submit" fullWidth isPending={isSubmitting} pendingLabel={pendingLabel}>
        {submitLabel}
      </AppButton>
    </form>
  );
}
