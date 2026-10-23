import type { Account } from '@acme/contracts';
import { formatAmount } from '@/app/helpers/money';
import { localHref } from '@/app/helpers/navigation';
import { useDisclosure } from '@/app/hooks/useDisclosure';
import { t } from '@/app/i18n';
import { ROUTES } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';
import { freezeControlOf } from '../helpers/accountRules';
import { useFreezeMutation, useUnfreezeMutation } from '../mutations/useAccountMutations';

/**
 * The card page of an open account: the card as printed (cardholder from the session), its
 * details, and its settings. Freezing and unfreezing always go through a confirmation; the dialog
 * closes only once the API answered (W5). The switch shows the account's state, never a guess.
 * A freeze by Acme Credit has no switch: the page says who froze it (freezeControlOf).
 */
export function useCardSettings(account: Account) {
  const freeze = useFreezeMutation();
  const unfreeze = useUnfreezeMutation();
  const confirm = useDisclosure();
  const depositDialog = useDisclosure();
  const holderName = useAuthStore((state) => state.user?.fullName ?? '');
  const { isFrozen, isFrozenByAdmin, canToggle } = freezeControlOf(account);
  const mutation = isFrozen ? unfreeze : freeze;

  return {
    card: account.card,
    holderName,
    isFrozen,
    isFrozenByAdmin,
    status: isFrozen
      ? { label: t('status.frozen'), tone: 'warning' as const }
      : { label: t('status.active'), tone: 'success' as const },
    limit: formatAmount(account.creditLimitCents),
    freezeSwitch: {
      isShown: canToggle,
      isSelected: isFrozen,
      // The switch asks; the confirmation acts. Its state follows the account, not the click.
      onChange: confirm.onOpen,
      isDisabled: mutation.isPending,
    },
    confirm: {
      isOpen: confirm.isOpen,
      onOpenChange: confirm.onOpenChange,
      title: t(isFrozen ? 'card.freeze.unfreezeTitle' : 'card.freeze.freezeTitle'),
      body: t(isFrozen ? 'card.freeze.unfreezeBody' : 'card.freeze.freezeBody'),
      confirmLabel: t(isFrozen ? 'card.freeze.unfreezeConfirm' : 'card.freeze.freezeConfirm'),
      onConfirm: () => mutation.mutate(account.id, { onSuccess: confirm.onClose }),
      isPending: mutation.isPending,
    },
    depositDialog,
    hrefs: { profile: localHref(ROUTES.profile) },
  };
}
