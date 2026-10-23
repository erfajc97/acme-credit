import {
  MAX_ACCOUNT_COLLATERAL_CENTS,
  MAX_DEPOSIT_CENTS,
  MIN_DEPOSIT_CENTS,
} from '@acme/contracts';
import { formatAmount } from '@/app/helpers/money';
import { t } from '@/app/i18n';
import { depositRoomOf } from '../helpers/accountRules';
import { useDepositMutation } from '../mutations/useTransferMutations';
import { depositFormSchema } from '../schema';
import { useTransferFlow } from './useTransferFlow';

/**
 * Adds to the security deposit (the first one activates the card; later ones raise the limit), up
 * to the per-account cap: the room left is shown, and at the cap the form gives way to a notice.
 */
export function useDepositFlow(accountId: string, collateralCents: string) {
  const mutation = useDepositMutation();
  const { roomCents, canDeposit } = depositRoomOf(collateralCents);
  const range = { min: formatAmount(MIN_DEPOSIT_CENTS), max: formatAmount(MAX_DEPOSIT_CENTS) };
  const room = { room: formatAmount(roomCents), cap: formatAmount(MAX_ACCOUNT_COLLATERAL_CENTS) };
  const flow = useTransferFlow({ kind: 'deposit', accountId, schema: depositFormSchema, mutation });
  return {
    ...flow,
    hint: `${t('deposit.amountHint', range)} ${t('deposit.roomHint', room)}`,
    room,
    canDeposit,
  };
}
