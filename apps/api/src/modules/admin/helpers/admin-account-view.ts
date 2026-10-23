import type { Account, AdminAccountAction, AdminCloseAccountResponse } from '@acme/contracts';
import type { CloseAccountResponse } from '../../accounts/dto/account-responses';

/**
 * What an admin action answers (A5): the account field by field, the card reduced to last 4 and
 * expiry. The card token is the credential a purchase is made with, so it never reaches the
 * back office. Applied to the lifecycle's answer, so an idempotent replay is masked too.
 */
export function toAdminAccountAction(account: Account): AdminAccountAction {
  return {
    id: account.id,
    status: account.status,
    currency: account.currency,
    collateralCents: account.collateralCents,
    creditLimitCents: account.creditLimitCents,
    heldCents: account.heldCents,
    postedDebtCents: account.postedDebtCents,
    availableCents: account.availableCents,
    card: account.card
      ? { last4: account.card.last4, expiresMonth: account.card.expiresMonth }
      : null,
    frozenBy: account.frozenBy,
    openedAt: account.openedAt,
    activatedAt: account.activatedAt,
    closedAt: account.closedAt,
  };
}

export function toAdminCloseResponse(response: CloseAccountResponse): AdminCloseAccountResponse {
  return { account: toAdminAccountAction(response.account), settlement: response.settlement };
}
