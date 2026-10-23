import type { Deposit, Repayment } from '@acme/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UseMutationResult } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { formatAmount } from '@/app/helpers/money';
import { safeApproveUrl } from '@/app/helpers/payments';
import type { PaymentKind } from '@/app/tanstack-queries/paymentsQuery';
import type { AmountRequest } from '../services/accountService';
import type { AmountFormInput, AmountFormValues } from '../types';
import { usePaymentWatch } from './usePaymentWatch';

interface TransferFlowOptions {
  kind: PaymentKind;
  accountId: string;
  schema: z.ZodType<AmountFormValues, AmountFormInput>;
  mutation: UseMutationResult<Deposit | Repayment, Error, AmountRequest>;
}

/**
 * A transfer from the customer's bank (deposit or payment): the amount form, then the approval
 * at the bank and its outcome. The form hides while a transfer waits: one in flight at a time.
 */
export function useTransferFlow({ kind, accountId, schema, mutation }: TransferFlowOptions) {
  const watch = usePaymentWatch(kind, accountId);
  const form = useForm<AmountFormInput, unknown, AmountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '' },
  });

  const onSubmit = form.handleSubmit(({ amount }) => {
    mutation.mutate(
      { accountId, amountCents: amount.toString() },
      {
        onSuccess: (payment) => {
          form.reset();
          watch.track(payment.id);
        },
      },
    );
  });

  return {
    watch,
    trackedAmount: watch.tracked ? formatAmount(watch.tracked.amountCents) : '',
    approveUrl: safeApproveUrl(watch.tracked?.checkout.approveUrl),
    control: form.control,
    onSubmit,
    isSubmitting: mutation.isPending,
    showForm: watch.state === 'idle' || watch.state === 'failed',
  };
}
