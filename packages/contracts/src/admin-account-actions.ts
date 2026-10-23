import type { z } from 'zod';
import { accountSchema, cardSchema, closeAccountResponseSchema } from './accounts';

/**
 * The card as the back office sees it: last 4 and expiry. Never the token: it is the credential
 * a purchase is made with, so only the card's owner gets it (A5).
 */
export const adminCardSchema = cardSchema.omit({ token: true }).strict();

/** Answer of an admin freeze / unfreeze: the account, its card masked. */
export const adminAccountActionSchema = accountSchema
  .extend({ card: adminCardSchema.nullable() })
  .strict();

/** Answer of an admin close: the closed account (card masked) and its settlement. */
export const adminCloseAccountResponseSchema = closeAccountResponseSchema
  .extend({ account: adminAccountActionSchema })
  .strict();

export type AdminAccountAction = z.infer<typeof adminAccountActionSchema>;
export type AdminCloseAccountResponse = z.infer<typeof adminCloseAccountResponseSchema>;
