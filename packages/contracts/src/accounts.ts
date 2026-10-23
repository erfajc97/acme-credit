import { z } from 'zod';
import { purchaseLineSchema } from './authorizations';
import { idSchema, isoDateTimeSchema } from './common';
import { balanceCentsSchema, centsSchema, signedCentsSchema } from './money';

/** Account life cycle (plan §Critical-service design). */
export const ACCOUNT_STATUSES = ['PENDING_COLLATERAL', 'ACTIVE', 'FROZEN', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Who froze the card: a customer cannot lift an admin's freeze. */
export const FREEZE_ACTORS = ['CUSTOMER', 'ADMIN'] as const;
export type FreezeActor = (typeof FREEZE_ACTORS)[number];

/** Why an admin froze a card (decision G11, proposal); a customer freeze is `customer_request`. */
export const ADMIN_FREEZE_REASONS = ['admin_review', 'suspected_fraud', 'collections'] as const;
export const FREEZE_REASONS = ['customer_request', ...ADMIN_FREEZE_REASONS] as const;
export type FreezeReason = (typeof FREEZE_REASONS)[number];

export const cardSchema = z
  .object({
    last4: z.string().regex(/^\d{4}$/),
    /** Opaque token the card network uses to identify the card; shown only to its owner. */
    token: z.string(),
    expiresMonth: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  })
  .strict();

export const accountSchema = z
  .object({
    id: idSchema,
    status: z.enum(ACCOUNT_STATUSES),
    currency: z.literal('USD'),
    /** Confirmed security deposit held as a guarantee. */
    collateralCents: balanceCentsSchema,
    creditLimitCents: balanceCentsSchema,
    /** Authorized but not yet captured purchases. */
    heldCents: balanceCentsSchema,
    /** Captured purchases not yet repaid. */
    postedDebtCents: balanceCentsSchema,
    /** creditLimit − held − postedDebt. */
    availableCents: balanceCentsSchema,
    card: cardSchema.nullable(),
    /** Who froze the card while FROZEN (an admin freeze explains why unfreeze is refused). */
    frozenBy: z.enum(FREEZE_ACTORS).nullable(),
    openedAt: isoDateTimeSchema,
    activatedAt: isoDateTimeSchema.nullable(),
    closedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export type Account = z.infer<typeof accountSchema>;

/** Money movements that need the customer to approve a transfer at the (simulated) bank. */
export const PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const amountRequestSchema = z.object({ amountCents: centsSchema }).strict();
export type AmountRequest = z.infer<typeof amountRequestSchema>;

/** Where the customer approves the transfer in the payment provider simulator. */
export const paymentCheckoutSchema = z
  .object({ paymentId: z.string(), approveUrl: z.url() })
  .strict();

export const depositSchema = z
  .object({
    id: idSchema,
    accountId: idSchema,
    amountCents: centsSchema,
    status: z.enum(PAYMENT_STATUSES),
    /** Limit granted per deposited cent, in basis points (10000 = 100 %), fixed at request time. */
    limitRatioBps: z.number().int(),
    checkout: paymentCheckoutSchema,
    createdAt: isoDateTimeSchema,
    confirmedAt: isoDateTimeSchema.nullable(),
    /**
     * Approve at the bank before this instant; after it a payment the bank still has not paid
     * becomes EXPIRED and stops counting as in flight (a late approval is still credited).
     */
    expiresAt: isoDateTimeSchema,
  })
  .strict();

export const repaymentSchema = depositSchema.omit({ limitRatioBps: true });

export type Deposit = z.infer<typeof depositSchema>;
export type Repayment = z.infer<typeof repaymentSchema>;

export const settlementSchema = z
  .object({
    collateralCents: balanceCentsSchema,
    appliedToDebtCents: balanceCentsSchema,
    releasedCents: balanceCentsSchema,
  })
  .strict();

export const closeAccountResponseSchema = z
  .object({ account: accountSchema, settlement: settlementSchema })
  .strict();

export type Settlement = z.infer<typeof settlementSchema>;

/** One line of the customer's activity, built from the ledger and the authorizations. */
export const ACTIVITY_TYPES = [
  'deposit',
  'purchase',
  'repayment',
  'collateral_applied',
  'collateral_released',
] as const;

export const activitySchema = z
  .object({
    id: z.string(),
    type: z.enum(ACTIVITY_TYPES),
    status: z.string(),
    amountCents: centsSchema,
    /** English summary kept for older clients; new clients build copy from the fields below. */
    description: z.string(),
    /** The merchant of a purchase; null for every other type. */
    merchantName: z.string().nullable(),
    /** Units across the order lines of a store purchase; 0 otherwise. */
    itemCount: z.number().int().min(0),
    /** Order lines of a store purchase; empty otherwise. */
    items: z.array(purchaseLineSchema),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type Activity = z.infer<typeof activitySchema>;

export const postingSchema = z
  .object({ ledgerAccount: z.string(), amountCents: signedCentsSchema })
  .strict();

export const journalEntrySchema = z
  .object({
    id: idSchema,
    kind: z.string(),
    accountId: idSchema.nullable(),
    description: z.string(),
    postings: z.array(postingSchema),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type JournalEntry = z.infer<typeof journalEntrySchema>;
