import {
  accountSchema,
  depositSchema,
  repaymentSchema,
  type Account,
  type Deposit,
  type Repayment,
} from '@acme/contracts';
import { apiRequest } from '@/app/lib/apiClient';
import { ENDPOINTS } from '@/app/lib/endpoints';
import { withIdempotencyKey } from '@/app/lib/idempotency';

/**
 * Every write here moves money or changes what can be spent, so each carries a client key that
 * survives reloads and is reused on retry (MO2, lib/idempotency.ts).
 */

export function openAccount(): Promise<Account> {
  return withIdempotencyKey({ action: 'account.open', payload: {} }, (idempotencyKey) =>
    apiRequest({
      path: ENDPOINTS.accounts.open,
      method: 'POST',
      schema: accountSchema,
      idempotencyKey,
    }),
  );
}

export interface AmountRequest {
  accountId: string;
  /** Integer cents as a digit string (P1). */
  amountCents: string;
}

export function createDeposit({ accountId, amountCents }: AmountRequest): Promise<Deposit> {
  return withIdempotencyKey(
    { action: 'deposit.create', payload: { accountId, amountCents } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.accounts.deposits(accountId),
        method: 'POST',
        body: { amountCents },
        schema: depositSchema,
        idempotencyKey,
      }),
  );
}

export function createRepayment({ accountId, amountCents }: AmountRequest): Promise<Repayment> {
  return withIdempotencyKey(
    { action: 'repayment.create', payload: { accountId, amountCents } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.accounts.repayments(accountId),
        method: 'POST',
        body: { amountCents },
        schema: repaymentSchema,
        idempotencyKey,
      }),
  );
}

export function freezeAccount(accountId: string): Promise<Account> {
  return withIdempotencyKey(
    { action: 'account.freeze', payload: { accountId } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.accounts.freeze(accountId),
        method: 'POST',
        schema: accountSchema,
        idempotencyKey,
      }),
  );
}

export function unfreezeAccount(accountId: string): Promise<Account> {
  return withIdempotencyKey(
    { action: 'account.unfreeze', payload: { accountId } },
    (idempotencyKey) =>
      apiRequest({
        path: ENDPOINTS.accounts.unfreeze(accountId),
        method: 'POST',
        schema: accountSchema,
        idempotencyKey,
      }),
  );
}
