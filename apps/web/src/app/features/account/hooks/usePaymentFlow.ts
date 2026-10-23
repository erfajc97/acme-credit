import { useMemo } from 'react';
import { formatAmount } from '@/app/helpers/money';
import { useRepaymentMutation } from '../mutations/useTransferMutations';
import { paymentFormSchema } from '../schema';
import { useTransferFlow } from './useTransferFlow';

/** Pays what is owed (posted purchases); never more than that (repayment.exceeds_debt). */
export function usePaymentFlow(accountId: string, postedDebtCents: string) {
  const owedCents = BigInt(postedDebtCents);
  const schema = useMemo(() => paymentFormSchema(owedCents), [owedCents]);
  const mutation = useRepaymentMutation();
  const flow = useTransferFlow({ kind: 'repayment', accountId, schema, mutation });
  return { ...flow, owed: formatAmount(owedCents), hasDebt: owedCents > 0n };
}
