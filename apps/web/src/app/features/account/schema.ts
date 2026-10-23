import { MAX_DEPOSIT_CENTS, MIN_DEPOSIT_CENTS } from '@acme/contracts';
import { z } from 'zod';
import { amountTextField } from '@/app/helpers/amountField';

/** Security deposit: USD 200 – 10,000 per deposit, the API's own constants (W11, G12). */
export const depositFormSchema = z.object({
  amount: amountTextField
    .refine((cents) => cents >= MIN_DEPOSIT_CENTS, 'validation.depositBelowMin')
    .refine((cents) => cents <= MAX_DEPOSIT_CENTS, 'validation.depositAboveMax'),
});

/**
 * A payment can never exceed what is owed (the API's repayment.exceeds_debt rule, checked here
 * first with the same comparison).
 */
export function paymentFormSchema(owedCents: bigint) {
  return z.object({
    amount: amountTextField.refine((cents) => cents <= owedCents, 'validation.paymentAboveOwed'),
  });
}
