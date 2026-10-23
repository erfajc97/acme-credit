import { AppHttpException } from '@acme/nest-core';
import { lockAccount } from '../../../core/database/account-lock';
import type { Tx } from '../../../core/database/transaction';
import { accountSelect, type AccountRow } from '../account.mapper';

/** Which account: a customer acts on their own (`ownerId`), an admin or a service on any. */
export interface AccountTarget {
  accountId: string;
  ownerId?: string;
}

/** Row lock first (ADR-0003), then the read that decides. Foreign or missing → 404 (A7). */
export async function lockAndRead(tx: Tx, target: AccountTarget): Promise<AccountRow> {
  const locked = await lockAccount(tx, target);
  if (!locked) throw new AppHttpException('common.not_found');
  return tx.account.findUniqueOrThrow({ where: { id: target.accountId }, select: accountSelect });
}
