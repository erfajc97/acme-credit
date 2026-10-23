import type { Tx } from './transaction';

/**
 * Takes the account row lock, the FIRST data statement of every transaction that writes an
 * account's money (ADR-0003): writers on one card queue, different cards never block each
 * other. `ownerId` scopes the lock to the customer's own account (A14): a foreign or missing
 * account locks nothing and returns false.
 */
export async function lockAccount(
  tx: Tx,
  target: { accountId: string; ownerId?: string },
): Promise<boolean> {
  const rows =
    target.ownerId === undefined
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM accounts WHERE id = ${target.accountId}::uuid FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM accounts
          WHERE id = ${target.accountId}::uuid AND customer_id = ${target.ownerId}::uuid
          FOR UPDATE`;
  return rows.length === 1;
}

/** Locks the account a card belongs to; null when no account carries that token. */
export async function lockAccountByCardToken(tx: Tx, cardToken: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM accounts WHERE card_token = ${cardToken} FOR UPDATE`;
  return rows[0]?.id ?? null;
}
