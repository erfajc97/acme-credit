import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';
import { balanceCentsSchema, centsSchema } from './money';

export const AUTHORIZATION_STATUSES = ['APPROVED', 'DECLINED', 'CAPTURED', 'REVERSED'] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

export const DECLINE_REASONS = [
  'insufficient_funds',
  'account_not_active',
  'card_frozen',
  'invalid_card',
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/**
 * Why a hold was released without a capture: the network voided it, it expired uncaptured, or
 * an admin released it. A capture after `expired` or `admin_release` is refused.
 */
export const REVERSAL_REASONS = ['network', 'expired', 'admin_release'] as const;
export type ReversalReason = (typeof REVERSAL_REASONS)[number];

export const MERCHANT_NAME_MAX = 80;
export const MAX_ORDER_LINES = 20;
export const MAX_LINE_QUANTITY = 20;

/** A priced order line of an in-wallet store purchase; the core stores it with the hold. */
export const orderLineSchema = z
  .object({
    sku: z.string().min(1).max(32),
    name: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    unitCents: centsSchema,
  })
  .strict();

export type OrderLine = z.infer<typeof orderLineSchema>;

/** Sum of priced lines, for the core to check the authorized amount (one rule, one place). */
export function linesTotalCents(lines: readonly OrderLine[]): bigint {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0n);
}

function lineTotalCents(line: OrderLine): bigint {
  return BigInt(line.unitCents) * BigInt(line.quantity);
}

/** An order line as the wallet shows it: priced per unit and per line, ready to display. */
export const purchaseLineSchema = z
  .object({
    sku: z.string(),
    name: z.string(),
    quantity: z.number().int().min(1),
    unitPriceCents: centsSchema,
    lineTotalCents: centsSchema,
  })
  .strict();

export type PurchaseLine = z.infer<typeof purchaseLineSchema>;

export function toPurchaseLines(lines: readonly OrderLine[]): PurchaseLine[] {
  return lines.map((line) => ({
    sku: line.sku,
    name: line.name,
    quantity: line.quantity,
    unitPriceCents: line.unitCents,
    lineTotalCents: lineTotalCents(line).toString(),
  }));
}

/** Units bought across the lines ("3 items"); 0 for a plain card purchase. */
export function itemCountOf(lines: readonly OrderLine[]): number {
  return lines.reduce((count, line) => count + line.quantity, 0);
}

const merchantSchema = z
  .object({
    name: z.string().trim().min(1).max(MERCHANT_NAME_MAX),
    /** ISO 18245 merchant category code. */
    mcc: z.string().regex(/^\d{4}$/),
  })
  .strict();

/** Card network → core (signed, P3). */
export const networkAuthorizationRequestSchema = z
  .object({
    cardToken: z.string().min(1).max(64),
    amountCents: centsSchema,
    merchant: merchantSchema,
    /** Store purchases: the priced lines; their total must equal amountCents. */
    items: z.array(orderLineSchema).min(1).max(MAX_ORDER_LINES).optional(),
  })
  .strict();

export const networkCaptureRequestSchema = z.object({ amountCents: centsSchema }).strict();

export const authorizationSchema = z
  .object({
    id: idSchema,
    accountId: idSchema.nullable(),
    amountCents: centsSchema,
    capturedCents: balanceCentsSchema,
    status: z.enum(AUTHORIZATION_STATUSES),
    declineReason: z.enum(DECLINE_REASONS).nullable(),
    merchantName: z.string(),
    merchantMcc: z.string(),
    /** Order lines of a store purchase; empty for a plain card purchase. */
    items: z.array(orderLineSchema),
    /** When an uncaptured hold is released on its own; null for a decline. */
    expiresAt: isoDateTimeSchema.nullable(),
    reversalReason: z.enum(REVERSAL_REASONS).nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type Authorization = z.infer<typeof authorizationSchema>;

/**
 * When each step of a purchase happened. The decision (approved or declined) is taken when the
 * authorization is created; a reversal is the network voiding the hold.
 */
export const authorizationTimelineSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    approvedAt: isoDateTimeSchema.nullable(),
    declinedAt: isoDateTimeSchema.nullable(),
    capturedAt: isoDateTimeSchema.nullable(),
    reversedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

/** One purchase of the customer's account (`GET /v1/accounts/:id/authorizations/:authorizationId`). */
export const authorizationDetailSchema = z
  .object({
    id: idSchema,
    accountId: idSchema,
    status: z.enum(AUTHORIZATION_STATUSES),
    declineReason: z.enum(DECLINE_REASONS).nullable(),
    merchantName: z.string(),
    merchantMcc: z.string(),
    /** What was authorized (held) and what the merchant finally captured. */
    amountCents: centsSchema,
    capturedCents: balanceCentsSchema,
    itemCount: z.number().int().min(0),
    items: z.array(purchaseLineSchema),
    timeline: authorizationTimelineSchema,
    /** When an uncaptured hold is released on its own; null for a decline. */
    expiresAt: isoDateTimeSchema.nullable(),
    reversalReason: z.enum(REVERSAL_REASONS).nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type AuthorizationDetail = z.infer<typeof authorizationDetailSchema>;

/** Customer app → card network simulator: a simulated purchase at a merchant. */
export const purchaseRequestSchema = z
  .object({
    cardToken: z.string().min(1).max(64),
    amountCents: centsSchema,
    merchant: merchantSchema,
  })
  .strict();

export const purchaseResultSchema = z
  .object({
    authorizationId: idSchema,
    status: z.enum(AUTHORIZATION_STATUSES),
    declineReason: z.enum(DECLINE_REASONS).nullable(),
    availableCents: balanceCentsSchema.nullable(),
  })
  .strict();

export type PurchaseRequest = z.infer<typeof purchaseRequestSchema>;
export type PurchaseResult = z.infer<typeof purchaseResultSchema>;

/** Merchants the purchase simulator offers (name + category). */
export const DEMO_MERCHANTS = [
  { name: 'Corner Grocery', mcc: '5411' },
  { name: 'City Fuel', mcc: '5541' },
  { name: 'Bookshop & Co.', mcc: '5942' },
  { name: 'Streamly', mcc: '4899' },
  { name: 'Trailhead Outfitters', mcc: '5941' },
] as const;
